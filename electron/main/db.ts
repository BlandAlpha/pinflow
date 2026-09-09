import { randomUUID } from 'node:crypto'
import Database from 'better-sqlite3'
import type {
  CreateTodoInput,
  Level,
  Quadrant,
  Step,
  Todo,
  TodoStatus,
  UpdateTodoInput
} from '@shared/types'
import { quadrantToLevels } from '@shared/quadrant'

/** 当前 schema 版本，递增时追加迁移步骤 */
const SCHEMA_VERSION = 2

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
  d.pragma(`user_version = ${SCHEMA_VERSION}`)
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

function mapTodo(row: TodoRow, steps: Step[]): Todo {
  return {
    id: row.id,
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
    `INSERT INTO todos (id, title, notes, importance, urgency, due_at, status, created_at, updated_at, completed_at, tags, pinned, classified, sort_order)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
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
  if (input.importance !== undefined) push('importance', input.importance)
  if (input.urgency !== undefined) push('urgency', input.urgency)
  if (input.dueAt !== undefined) push('due_at', input.dueAt)
  if (input.tags !== undefined) push('tags', JSON.stringify(input.tags))
  if (input.pinned !== undefined) push('pinned', input.pinned ? 1 : 0)
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
  return updateTodo({ id, importance, urgency, classified: true })
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

export function allTags(): string[] {
  const d = instance()
  const rows = d.prepare('SELECT tags FROM todos').all() as { tags: string }[]
  const set = new Set<string>()
  for (const r of rows) for (const t of parseTags(r.tags)) set.add(t)
  return [...set].sort((a, b) => a.localeCompare(b, 'zh-CN'))
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
