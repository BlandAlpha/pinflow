import { createRequire } from 'node:module'
import { beforeAll, describe, expect, it, vi } from 'vitest'

// prefs.ts 依赖 electron；db.ts 通过它读取当前空间，测试里给个最小替身即可。
vi.mock('electron', () => ({
  BrowserWindow: { getAllWindows: () => [] },
  nativeTheme: { shouldUseDarkColors: false, on: () => {}, off: () => {} },
  app: { getPath: () => '', getAppPath: () => '' }
}))

const nodeRequire = createRequire(import.meta.url)

/**
 * 本机 better-sqlite3 通常只有 Electron ABI 的原生二进制，纯 Node 下 require 会抛
 * "was compiled against a different Node.js version"。
 * 这时整组测试跳过 —— `npm test` 仍然可用；装了 Node ABI 构建（或 npm rebuild）
 * 之后会自动启用，无需改代码。
 */
let nativeOk = true
try {
  // 必须真的建一个实例：模块本身能 require 成功，原生 binding 未必能加载
  const SqliteDatabase = nodeRequire('better-sqlite3') as new (path: string) => { close(): void }
  new SqliteDatabase(':memory:').close()
} catch {
  nativeOk = false
}

type DbModule = typeof import('../electron/main/db')

let db: DbModule | null = null
if (nativeOk) {
  db = (await import('../electron/main/db')) as DbModule
}

/** 未启用时下面的 describe 会被跳过，取值一定非空 */
const d = (): DbModule => db as DbModule

let spaceAId = ''
let spaceBId = ''

const describeDb = nativeOk ? describe : describe.skip

describeDb('db', () => {
  beforeAll(() => {
    if (!nativeOk) return
    d().initDatabase(':memory:')
    spaceAId = d().createSpace({ name: '测试空间A' }).id
    spaceBId = d().createSpace({ name: '测试空间B' }).id
  })

  it('任务归属创建时指定的空间，不会跨空间串数据', () => {
    const a = d().createTodo({ title: 'A的任务', spaceId: spaceAId })
    const b = d().createTodo({ title: 'B的任务', spaceId: spaceBId })
    expect(a.spaceId).toBe(spaceAId)
    expect(b.spaceId).toBe(spaceBId)
    expect(d().listTodos().filter((t) => t.spaceId === spaceAId).map((t) => t.title)).toContain(
      'A的任务'
    )
  })

  it('删除空间会把任务迁移到接手空间，而不是一起删掉', () => {
    const tmp = d().createSpace({ name: '待删除' })
    const todo = d().createTodo({ title: '会被迁移', spaceId: tmp.id })
    const res = d().deleteSpace(tmp.id, spaceAId)
    expect(res.removed).toBe(true)
    expect(res.movedCount).toBe(1)
    expect(d().getTodo(todo.id).spaceId).toBe(spaceAId)
  })

  it('撤销删除（restoreTodo）保留 id / 创建时间 / 状态 / 步骤 / 坐标', () => {
    const todo = d().createTodo({ title: '待恢复', notes: '备注', spaceId: spaceAId })
    d().addStep(todo.id, '第一步')
    d().addStep(todo.id, '第二步')
    d().toggleStep(d().getTodo(todo.id).steps[0].id)
    d().setBoardPosition(todo.id, 0.8, 0.2)

    const before = d().getTodo(todo.id)
    d().deleteTodo(todo.id)
    expect(d().listTodos().some((t) => t.id === todo.id)).toBe(false)

    const back = d().restoreTodo(before)
    expect(back.id).toBe(before.id)
    expect(back.createdAt).toBe(before.createdAt)
    expect(back.updatedAt).toBe(before.updatedAt)
    expect(back.status).toBe(before.status)
    expect(back.spaceId).toBe(spaceAId)
    expect(back.steps.map((s) => s.title)).toEqual(['第一步', '第二步'])
    expect(back.steps[0].completed).toBe(true)
    expect(back.boardX).toBeCloseTo(0.8, 5)
    expect(back.boardY).toBeCloseTo(0.2, 5)
  })

  it('白板落点推导重要度/紧急度，且不刷新 updated_at', () => {
    const todo = d().createTodo({ title: '拖拽', spaceId: spaceAId })
    const beforeUpdatedAt = d().getTodo(todo.id).updatedAt
    // 右上 = 重要且紧急
    const moved = d().setBoardPosition(todo.id, 0.9, 0.1)
    expect(moved.importance).toBe('high')
    expect(moved.urgency).toBe('high')
    expect(moved.classified).toBe(true)
    // 拖动属于摆放，不该刷新更新时间，否则「按更新时间排序」失去意义
    expect(moved.updatedAt).toBe(beforeUpdatedAt)
  })

  it('批量落点（setBoardPositions）一次写入多条', () => {
    const t1 = d().createTodo({ title: '批量1', spaceId: spaceAId })
    const t2 = d().createTodo({ title: '批量2', spaceId: spaceAId })
    const todos = d().setBoardPositions([
      { id: t1.id, x: 0.1, y: 0.9 },
      { id: t2.id, x: 0.9, y: 0.9 }
    ])
    const m1 = todos.find((t) => t.id === t1.id)!
    const m2 = todos.find((t) => t.id === t2.id)!
    expect(m1.importance).toBe('low')
    expect(m1.urgency).toBe('low')
    expect(m2.importance).toBe('low')
    expect(m2.urgency).toBe('high')
  })

  it('allTags 按空间过滤，不传则跨空间', () => {
    const a = d().createTodo({ title: '带标签A', spaceId: spaceAId })
    const b = d().createTodo({ title: '带标签B', spaceId: spaceBId })
    d().addTag(a.id, '仅A可见')
    d().addTag(b.id, '仅B可见')
    expect(d().allTags(spaceAId)).toContain('仅A可见')
    expect(d().allTags(spaceAId)).not.toContain('仅B可见')
    expect(d().allTags()).toContain('仅A可见')
    expect(d().allTags()).toContain('仅B可见')
  })

  // 必须放最后：它把空间删到只剩一个，后面的用例都依赖 spaceA/spaceB
  it('不允许删掉最后一个空间', () => {
    const spaces = d().listSpaces()
    for (const s of spaces.slice(0, -1)) {
      d().deleteSpace(s.id)
    }
    const last = d().listSpaces()
    expect(last.length).toBe(1)
    expect(d().deleteSpace(last[0].id).removed).toBe(false)
  })
})
