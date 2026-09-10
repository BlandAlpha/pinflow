import { randomUUID } from 'node:crypto'
import Database from 'better-sqlite3'
import type {
  CreateSpaceInput,
  CreateTodoInput,
  Level,
  Quadrant,
  Space,
  SpaceColor,
  SpaceDeleteResult,
  SpaceIcon,
  Step,
  Todo,
  TodoStatus,
  UpdateSpaceInput,
  UpdateTodoInput
} from '@shared/types'
import { SPACE_COLORS, SPACE_ICONS } from '@shared/types'
import { quadrantToLevels } from '@shared/quadrant'
import { positionForQuadrant, levelsAt } from '@shared/board'
import { getPrefs } from './prefs'

/** 当前 schema 版本，递增时追加迁移步骤 */
const SCHEMA_VERSION = 5

/** 出厂默认空间：工作 / 生活（固定 id，便于迁移与偏好记忆） */
const DEFAULT_SPACES: { id: string; name: string; icon: SpaceIcon; color: SpaceColor }[] = [
  { id: 'work', name: '工作', icon: 'briefcase', color: 'blue' },
  { id: 'life', name: '生活', icon: 'home', color: 'green' }
]

interface TodoRow {
  id: string
  title: string
  notes: string
  importance: string
  urgency: string
  due_at: string | null
  status: string
  created_at: string
  updated_at: string
  completed_at: string | null
  tags: string
  pinned: number
  classified: number
  sort_order: number
  board_x: number | null
  board_y: number | null
  space_id: string | null
}

interface SpaceRow {
  id: string
  name: string
  icon: string
  color: string
  sort_order: number
  created_at: string
}

interface StepRow {
  id: string
  todo_id: string
  title: string
  completed: number
  sort_order: number
}

let db: Database.Database | null = null
let dbFilePath = ''

export function initDatabase(file: string): void {
  dbFilePath = file
  db = new Database(file)
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')
  migrate(db)
}

export function getDbPath(): string {
  return dbFilePath
}

function instance(): Database.Database {
  if (!db) throw new Error('数据库尚未初始化')
  return db
}

/** 自动建表 / 迁移 */
function migrate(d: Database.Database): void {
  const current = d.pragma('user_version', { simple: true }) as number
  if (current < 1) {
    d.exec(`
      CREATE TABLE IF NOT EXISTS todos (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        notes TEXT NOT NULL DEFAULT '',
        importance TEXT NOT NULL DEFAULT 'normal',
        urgency TEXT NOT NULL DEFAULT 'normal',
        due_at TEXT,
        status TEXT NOT NULL DEFAULT 'active',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        completed_at TEXT,
        tags TEXT NOT NULL DEFAULT '[]',
        pinned INTEGER NOT NULL DEFAULT 0
      );
      CREATE TABLE IF NOT EXISTS steps (
        id TEXT PRIMARY KEY,
        todo_id TEXT NOT NULL REFERENCES todos(id) ON DELETE CASCADE,
        title TEXT NOT NULL,
        completed INTEGER NOT NULL DEFAULT 0,
        sort_order INTEGER NOT NULL DEFAULT 0
      );
      CREATE INDEX IF NOT EXISTS idx_steps_todo ON steps(todo_id);
      CREATE INDEX IF NOT EXISTS idx_todos_status ON todos(status);
    `)
  }
  if (current < 2) {
    // v2：显式分类标记 + 列表内手动排序（渐进式分类：默认未分类，留在收件箱）
    const cols = d.prepare('PRAGMA table_info(todos)').all() as { name: string }[]
    if (!cols.some((c) => c.name === 'classified')) {
      d.exec('ALTER TABLE todos ADD COLUMN classified INTEGER NOT NULL DEFAULT 0')
    }
    if (!cols.some((c) => c.name === 'sort_order')) {
      d.exec('ALTER TABLE todos ADD COLUMN sort_order INTEGER NOT NULL DEFAULT 0')
    }
    // 回填：已被明确设置过属性（重要度/紧急度/截止/置顶/标签）的任务视为已分类
    d.exec(`
      UPDATE todos SET classified = 1
      WHERE classified = 0 AND (
        importance <> 'normal' OR urgency <> 'normal'
        OR due_at IS NOT NULL OR pinned = 1
        OR (tags IS NOT NULL AND tags <> '[]')
      );
    `)
    // 回填排序：按创建顺序
    d.exec(`
      UPDATE todos SET sort_order = (
        SELECT COUNT(*) FROM todos t2 WHERE t2.rowid < todos.rowid
      ) WHERE sort_order = 0;
    `)
  }
  if (current < 3) {
    // v3：白板坐标（连续的重要性 × 紧急性空间）
    const cols = d.prepare('PRAGMA table_info(todos)').all() as { name: string }[]
    if (!cols.some((c) => c.name === 'board_x')) {
      d.exec('ALTER TABLE todos ADD COLUMN board_x REAL')
    }
    if (!cols.some((c) => c.name === 'board_y')) {
      d.exec('ALTER TABLE todos ADD COLUMN board_y REAL')
    }
    // 回填：已有分类的任务按象限落到对应区域，并按 id 做稳定抖动避免完全重叠
    const rows = d
      .prepare(
        `SELECT id, importance, urgency, classified FROM todos WHERE board_x IS NULL OR board_y IS NULL`
      )
      .all() as { id: string; importance: string; urgency: string; classified: number }[]
    const upd = d.prepare('UPDATE todos SET board_x = ?, board_y = ? WHERE id = ?')
    const tx = d.transaction((list: typeof rows) => {
      list.forEach((r, i) => {
        const q = levelToQuadrant(toLevel(r.importance), toLevel(r.urgency))
        const base = positionForQuadrant(q)
        const jitter = (hash01(r.id, i) - 0.5) * 0.18
        const jitter2 = (hash01(r.id, i + 977) - 0.5) * 0.18
        upd.run(
          Math.min(0.97, Math.max(0.03, base.x + jitter)),
          Math.min(0.97, Math.max(0.03, base.y + jitter2)),
          r.id
        )
      })
    })
    tx(rows)
  }
  if (current < 4) {
    // v4：坐标系改为数学约定（右=紧急、上=重要）。旧数据落在「左=紧急」，整列水平翻转即可。
    d.exec('UPDATE todos SET board_x = 1 - board_x WHERE board_x IS NOT NULL')
  }
  if (current < 5) {
    // v5：空间（工作 / 生活…）——把不同生活面的任务彻底分开
    d.exec(`
      CREATE TABLE IF NOT EXISTS spaces (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        icon TEXT NOT NULL DEFAULT 'folder',
        color TEXT NOT NULL DEFAULT 'blue',
        sort_order INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL
      );
    `)
    const count = d.prepare('SELECT COUNT(*) AS c FROM spaces').get() as { c: number }
    if (count.c === 0) {
      const ins = d.prepare(
        'INSERT INTO spaces (id, name, icon, color, sort_order, created_at) VALUES (?, ?, ?, ?, ?, ?)'
      )
      const ts = new Date().toISOString()
      DEFAULT_SPACES.forEach((s, i) => ins.run(s.id, s.name, s.icon, s.color, i, ts))
    }
    const cols = d.prepare('PRAGMA table_info(todos)').all() as { name: string }[]
    if (!cols.some((c) => c.name === 'space_id')) {
      d.exec('ALTER TABLE todos ADD COLUMN space_id TEXT')
    }
    const fallback = defaultSpaceId(d)
    d.prepare('UPDATE todos SET space_id = ? WHERE space_id IS NULL OR space_id = ?').run(
      fallback,
      ''
    )
    d.exec('CREATE INDEX IF NOT EXISTS idx_todos_space ON todos(space_id)')
  }
  d.pragma(`user_version = ${SCHEMA_VERSION}`)
}

/** 第一个空间（按排序），作为兜底归属 */
function defaultSpaceId(d: Database.Database = instance()): string {
  const row = d
    .prepare('SELECT id FROM spaces ORDER BY sort_order ASC, created_at ASC LIMIT 1')
    .get() as { id: string } | undefined
  return row?.id ?? DEFAULT_SPACES[0].id
}

/** 解析任务该落到哪个空间：显式指定 > 偏好里的当前空间 > 第一个空间 */
function resolveSpaceId(d: Database.Database, explicit?: string): string {
  if (explicit) {
    const hit = d.prepare('SELECT id FROM spaces WHERE id = ?').get(explicit) as
      | { id: string }
      | undefined
    if (hit) return hit.id
  }
  const preferred = getPrefs().activeSpaceId
  if (preferred) {
    const hit = d.prepare('SELECT id FROM spaces WHERE id = ?').get(preferred) as
      | { id: string }
      | undefined
    if (hit) return hit.id
  }
  return defaultSpaceId(d)
}

function levelToQuadrant(importance: Level, urgency: Level): 1 | 2 | 3 | 4 {
  const important = importance === 'high'
  const urgent = urgency === 'high'
  if (important && urgent) return 1
  if (important && !urgent) return 2
  if (!important && urgent) return 3
  return 4
}

function hash01(seed: string, salt: number): number {
  let h = 2166136261 ^ salt
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return ((h >>> 0) % 10000) / 10000
}

/* ------------------------------ 映射 ------------------------------ */

function toLevel(v: string): Level {
  return v === 'low' || v === 'high' ? v : 'normal'
}

function toStatus(v: string): TodoStatus {
  return v === 'completed' || v === 'archived' ? v : 'active'
}

function parseTags(raw: string): string[] {
  try {
    const v = JSON.parse(raw)
    return Array.isArray(v) ? v.filter((t): t is string => typeof t === 'string') : []
  } catch {
    return []
  }
}

function toSpaceIcon(v: string): SpaceIcon {
  return (SPACE_ICONS as string[]).includes(v) ? (v as SpaceIcon) : 'folder'
}

function toSpaceColor(v: string): SpaceColor {
  return (SPACE_COLORS as string[]).includes(v) ? (v as SpaceColor) : 'blue'
}

function mapSpace(row: SpaceRow): Space {
  return {
    id: row.id,
    name: row.name,
    icon: toSpaceIcon(row.icon),
    color: toSpaceColor(row.color),
    order: row.sort_order ?? 0,
    createdAt: row.created_at
  }
}

function mapTodo(row: TodoRow, steps: Step[]): Todo {
  return {
    id: row.id,
    spaceId: row.space_id ?? defaultSpaceId(),
    title: row.title,
    notes: row.notes,
    importance: toLevel(row.importance),
    urgency: toLevel(row.urgency),
    dueAt: row.due_at,
    status: toStatus(row.status),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    completedAt: row.completed_at,
    tags: parseTags(row.tags),
    pinned: row.pinned === 1,
    classified: row.classified === 1,
    order: row.sort_order ?? 0,
    boardX: row.board_x ?? null,
    boardY: row.board_y ?? null,
    steps
  }
}

function mapStep(row: StepRow): Step {
  return {
    id: row.id,
    todoId: row.todo_id,
    title: row.title,
    completed: row.completed === 1,
    order: row.sort_order
  }
}

function nowIso(): string {
  return new Date().toISOString()
}

/* ------------------------------ 查询 ------------------------------ */

export function listTodos(): Todo[] {
  const d = instance()
  const todoRows = d
    .prepare('SELECT * FROM todos ORDER BY sort_order ASC, created_at ASC')
    .all() as TodoRow[]
  const stepRows = d
    .prepare('SELECT * FROM steps ORDER BY sort_order ASC, rowid ASC')
    .all() as StepRow[]

  const grouped = new Map<string, Step[]>()
  for (const row of stepRows) {
    const list = grouped.get(row.todo_id) ?? []
    list.push(mapStep(row))
    grouped.set(row.todo_id, list)
  }
  return todoRows.map((row) => mapTodo(row, grouped.get(row.id) ?? []))
}

export function getTodo(id: string): Todo {
  const d = instance()
  const row = d.prepare('SELECT * FROM todos WHERE id = ?').get(id) as TodoRow | undefined
  if (!row) throw new Error(`任务不存在: ${id}`)
  const steps = (
    d.prepare('SELECT * FROM steps WHERE todo_id = ? ORDER BY sort_order ASC').all(id) as StepRow[]
  ).map(mapStep)
  return mapTodo(row, steps)
}

/* ------------------------------ 写入 ------------------------------ */

export function createTodo(input: CreateTodoInput): Todo {
  const d = instance()
  const ts = nowIso()
  const id = randomUUID()
  const min = d.prepare('SELECT COALESCE(MIN(sort_order), 0) AS m FROM todos').get() as { m: number }
  d.prepare(
    `INSERT INTO todos (id, space_id, title, notes, importance, urgency, due_at, status, created_at, updated_at, completed_at, tags, pinned, classified, sort_order)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    resolveSpaceId(d, input.spaceId),
    input.title.trim(),
    input.notes ?? '',
    input.importance ?? 'normal',
    input.urgency ?? 'normal',
    input.dueAt ?? null,
    input.status ?? 'active',
    ts,
    ts,
    null,
    JSON.stringify(input.tags ?? []),
    input.pinned ? 1 : 0,
    input.classified ? 1 : 0,
    // 新任务排在最前
    Math.min(0, min.m) - 1
  )
  return getTodo(id)
}

export function updateTodo(input: UpdateTodoInput): Todo {
  const d = instance()
  const sets: string[] = []
  const values: unknown[] = []

  const push = (col: string, value: unknown) => {
    sets.push(`${col} = ?`)
    values.push(value)
  }

  if (input.title !== undefined) push('title', input.title.trim())
  if (input.notes !== undefined) push('notes', input.notes)
  if (input.spaceId !== undefined) push('space_id', resolveSpaceId(d, input.spaceId))
  if (input.importance !== undefined) push('importance', input.importance)
  if (input.urgency !== undefined) push('urgency', input.urgency)
  if (input.dueAt !== undefined) push('due_at', input.dueAt)
  if (input.tags !== undefined) push('tags', JSON.stringify(input.tags))
  if (input.pinned !== undefined) push('pinned', input.pinned ? 1 : 0)
  if (input.boardX !== undefined) push('board_x', input.boardX)
  if (input.boardY !== undefined) push('board_y', input.boardY)
  // 任何一次明确的属性编辑（象限/截止/置顶/标签）都视为「已分类」，任务随之离开收件箱
  const impliesClassified =
    input.importance !== undefined ||
    input.urgency !== undefined ||
    input.dueAt !== undefined ||
    input.pinned !== undefined ||
    (input.tags !== undefined && input.tags.length > 0)
  if (input.classified !== undefined) push('classified', input.classified ? 1 : 0)
  else if (impliesClassified) push('classified', 1)
  if (input.status !== undefined) {
    push('status', input.status)
    push('completed_at', input.status === 'completed' ? (input.completedAt ?? nowIso()) : null)
  }
  if (sets.length === 0) return getTodo(input.id)

  push('updated_at', nowIso())
  values.push(input.id)
  d.prepare(`UPDATE todos SET ${sets.join(', ')} WHERE id = ?`).run(...values)
  return getTodo(input.id)
}

export function deleteTodo(id: string): boolean {
  const d = instance()
  const res = d.prepare('DELETE FROM todos WHERE id = ?').run(id)
  return res.changes > 0
}

export function toggleTodo(id: string): Todo {
  const current = getTodo(id)
  const next: TodoStatus = current.status === 'completed' ? 'active' : 'completed'
  return updateTodo({ id, status: next })
}

export function setQuadrant(id: string, quadrant: Quadrant): Todo {
  const { importance, urgency } = quadrantToLevels(quadrant)
  const p = positionForQuadrant(quadrant)
  return updateTodo({ id, importance, urgency, classified: true, boardX: p.x, boardY: p.y })
}

/** 白板拖拽：写入坐标，并按坐标推导内部重要度/紧急度 */
export function setBoardPosition(id: string, x: number, y: number): Todo {
  const cx = Math.min(1, Math.max(0, x))
  const cy = Math.min(1, Math.max(0, y))
  const levels = levelsAt({ x: cx, y: cy })
  return updateTodo({ id, boardX: cx, boardY: cy, ...levels, classified: true })
}

/** 在同一象限内重排：orderedIds 为期望顺序 */
export function reorderTodos(orderedIds: string[]): Todo[] {
  const d = instance()
  const tx = d.transaction((ids: string[]) => {
    ids.forEach((id, index) => {
      d.prepare('UPDATE todos SET sort_order = ? WHERE id = ?').run(index, id)
    })
  })
  tx(orderedIds)
  return listTodos()
}

export function addTag(id: string, tag: string): Todo {
  const t = getTodo(id)
  const clean = tag.trim().replace(/^#/, '')
  if (!clean || t.tags.includes(clean)) return t
  return updateTodo({ id, tags: [...t.tags, clean] })
}

export function removeTag(id: string, tag: string): Todo {
  const t = getTodo(id)
  return updateTodo({ id, tags: t.tags.filter((x) => x !== tag) })
}

export function allTags(spaceId?: string | null): string[] {
  const d = instance()
  const rows = (
    spaceId
      ? d.prepare('SELECT tags FROM todos WHERE space_id = ?').all(spaceId)
      : d.prepare('SELECT tags FROM todos').all()
  ) as { tags: string }[]
  const set = new Set<string>()
  for (const r of rows) for (const t of parseTags(r.tags)) set.add(t)
  return [...set].sort((a, b) => a.localeCompare(b, 'zh-CN'))
}

/* ------------------------------ 空间 ------------------------------ */

export function listSpaces(): Space[] {
  const d = instance()
  return (
    d.prepare('SELECT * FROM spaces ORDER BY sort_order ASC, created_at ASC').all() as SpaceRow[]
  ).map(mapSpace)
}

export function createSpace(input: CreateSpaceInput): Space {
  const d = instance()
  const id = randomUUID()
  const max = d.prepare('SELECT COALESCE(MAX(sort_order), -1) AS m FROM spaces').get() as {
    m: number
  }
  d.prepare(
    'INSERT INTO spaces (id, name, icon, color, sort_order, created_at) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(
    id,
    input.name.trim() || '新空间',
    input.icon ?? 'folder',
    input.color ?? 'blue',
    max.m + 1,
    nowIso()
  )
  const row = d.prepare('SELECT * FROM spaces WHERE id = ?').get(id) as SpaceRow
  return mapSpace(row)
}

export function updateSpace(id: string, patch: UpdateSpaceInput): Space {
  const d = instance()
  const sets: string[] = []
  const values: unknown[] = []
  if (patch.name !== undefined && patch.name.trim()) {
    sets.push('name = ?')
    values.push(patch.name.trim())
  }
  if (patch.icon !== undefined) {
    sets.push('icon = ?')
    values.push(patch.icon)
  }
  if (patch.color !== undefined) {
    sets.push('color = ?')
    values.push(patch.color)
  }
  if (sets.length > 0) {
    values.push(id)
    d.prepare(`UPDATE spaces SET ${sets.join(', ')} WHERE id = ?`).run(...values)
  }
  const row = d.prepare('SELECT * FROM spaces WHERE id = ?').get(id) as SpaceRow | undefined
  if (!row) throw new Error(`空间不存在: ${id}`)
  return mapSpace(row)
}

/**
 * 删除空间：其中的任务不会被删掉，而是搬到一个仍然存在的空间。
 * 只剩最后一个空间时拒绝删除。
 */
export function deleteSpace(id: string, moveToId?: string): SpaceDeleteResult {
  const d = instance()
  const all = listSpaces()
  if (all.length <= 1) return { removed: false, movedTo: null, movedCount: 0 }
  const target =
    (moveToId && all.find((s) => s.id === moveToId && s.id !== id)?.id) ??
    all.find((s) => s.id !== id)?.id ??
    null
  if (!target) return { removed: false, movedTo: null, movedCount: 0 }

  const moved = d.prepare('UPDATE todos SET space_id = ? WHERE space_id = ?').run(target, id)
  d.prepare('DELETE FROM spaces WHERE id = ?').run(id)
  return { removed: true, movedTo: target, movedCount: moved.changes }
}

/* ------------------------------ 步骤 ------------------------------ */

export function addStep(todoId: string, title: string): Step {
  const d = instance()
  const max = d
    .prepare('SELECT COALESCE(MAX(sort_order), -1) AS m FROM steps WHERE todo_id = ?')
    .get(todoId) as { m: number }
  const id = randomUUID()
  d.prepare(
    'INSERT INTO steps (id, todo_id, title, completed, sort_order) VALUES (?, ?, ?, 0, ?)'
  ).run(id, todoId, title.trim(), max.m + 1)
  // 步骤变化同步父任务更新时间
  d.prepare('UPDATE todos SET updated_at = ? WHERE id = ?').run(nowIso(), todoId)
  const row = d.prepare('SELECT * FROM steps WHERE id = ?').get(id) as StepRow
  return mapStep(row)
}

export function updateStep(stepId: string, patch: Partial<Pick<Step, 'title' | 'completed'>>): Step {
  const d = instance()
  const sets: string[] = []
  const values: unknown[] = []
  if (patch.title !== undefined) {
    sets.push('title = ?')
    values.push(patch.title.trim())
  }
  if (patch.completed !== undefined) {
    sets.push('completed = ?')
    values.push(patch.completed ? 1 : 0)
  }
  if (sets.length === 0) {
    const row = d.prepare('SELECT * FROM steps WHERE id = ?').get(stepId) as StepRow
    return mapStep(row)
  }
  values.push(stepId)
  d.prepare(`UPDATE steps SET ${sets.join(', ')} WHERE id = ?`).run(...values)
  const row = d.prepare('SELECT * FROM steps WHERE id = ?').get(stepId) as StepRow
  d.prepare('UPDATE todos SET updated_at = ? WHERE id = ?').run(nowIso(), row.todo_id)
  return mapStep(row)
}

export function toggleStep(stepId: string): Step {
  const d = instance()
  const row = d.prepare('SELECT * FROM steps WHERE id = ?').get(stepId) as StepRow
  return updateStep(stepId, { completed: row.completed !== 1 })
}

export function deleteStep(stepId: string): boolean {
  const d = instance()
  const row = d.prepare('SELECT todo_id FROM steps WHERE id = ?').get(stepId) as
    | { todo_id: string }
    | undefined
  const res = d.prepare('DELETE FROM steps WHERE id = ?').run(stepId)
  if (row) d.prepare('UPDATE todos SET updated_at = ? WHERE id = ?').run(nowIso(), row.todo_id)
  return res.changes > 0
}

export function reorderSteps(todoId: string, orderedStepIds: string[]): Step[] {
  const d = instance()
  const tx = d.transaction((ids: string[]) => {
    ids.forEach((id, index) => {
      d.prepare('UPDATE steps SET sort_order = ? WHERE id = ? AND todo_id = ?').run(
        index,
        id,
        todoId
      )
    })
  })
  tx(orderedStepIds)
  return (
    d
      .prepare('SELECT * FROM steps WHERE todo_id = ? ORDER BY sort_order ASC')
      .all(todoId) as StepRow[]
  ).map(mapStep)
}
