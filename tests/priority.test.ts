import { describe, expect, it } from 'vitest'
import { WEIGHTS, explainPriority, priorityScore, sortByPriority } from '@shared/priority'
import type { Level, Todo } from '@shared/types'

const NOW = new Date('2026-01-10T09:00:00Z')

function todo(patch: Partial<Todo> = {}): Todo {
  return {
    id: 't1',
    title: 'test',
    notes: '',
    importance: 'normal',
    urgency: 'normal',
    dueAt: null,
    status: 'active',
    createdAt: '2026-01-01T09:00:00Z',
    updatedAt: '2026-01-01T09:00:00Z',
    completedAt: null,
    tags: [],
    pinned: false,
    steps: [],
    ...patch
  }
}

describe('priorityScore', () => {
  it('重要度权重递增', () => {
    const low = priorityScore(todo({ importance: 'low' }), NOW)
    const normal = priorityScore(todo({ importance: 'normal' }), NOW)
    const high = priorityScore(todo({ importance: 'high' }), NOW)
    expect(low).toBeLessThan(normal)
    expect(normal).toBeLessThan(high)
    expect(normal - low).toBe(WEIGHTS.importance.normal)
    expect(high - normal).toBe(WEIGHTS.importance.high - WEIGHTS.importance.normal)
  })

  it('紧急度权重递增', () => {
    const low = priorityScore(todo({ urgency: 'low' }), NOW)
    const high = priorityScore(todo({ urgency: 'high' }), NOW)
    expect(low).toBeLessThan(high)
  })

  it('逾期任务分数高于今天到期，今天到期高于下周', () => {
    const overdue = priorityScore(todo({ dueAt: '2026-01-08T09:00:00Z' }), NOW)
    const today = priorityScore(todo({ dueAt: '2026-01-10T20:00:00Z' }), NOW)
    const nextWeek = priorityScore(todo({ dueAt: '2026-01-14T09:00:00Z' }), NOW)
    const far = priorityScore(todo({ dueAt: '2026-03-01T09:00:00Z' }), NOW)
    expect(overdue).toBeGreaterThan(today)
    expect(today).toBeGreaterThan(nextWeek)
    expect(nextWeek).toBeGreaterThan(far)
  })

  it('逾期越久分数越高（有上限）', () => {
    const d2 = priorityScore(todo({ dueAt: '2026-01-08T09:00:00Z' }), NOW)
    const d5 = priorityScore(todo({ dueAt: '2026-01-05T09:00:00Z' }), NOW)
    const d60 = explainPriority(todo({ dueAt: '2025-11-11T09:00:00Z' }), NOW)
    expect(d5).toBeGreaterThan(d2)
    expect(d60.deadline).toBe(WEIGHTS.deadline.overdueBase + WEIGHTS.deadline.overdueExtraCap)
  })

  it('无截止日期不获得截止分数', () => {
    const b = explainPriority(todo(), NOW)
    expect(b.deadline).toBe(WEIGHTS.deadline.none)
  })

  it('任务越老分数缓慢爬升并封顶', () => {
    const young = priorityScore(todo({ createdAt: '2026-01-10T08:00:00Z' }), NOW)
    const old = priorityScore(todo({ createdAt: '2025-12-01T08:00:00Z' }), NOW)
    const ancient = priorityScore(todo({ createdAt: '2020-01-01T08:00:00Z' }), NOW)
    expect(old).toBeGreaterThan(young)
    expect(ancient - young).toBeLessThanOrEqual(WEIGHTS.age.cap)
    expect(explainPriority(todo({ createdAt: '2020-01-01T08:00:00Z' }), NOW).age).toBe(
      WEIGHTS.age.cap
    )
  })

  it('置顶任务始终排在最前', () => {
    const pinned = todo({ id: 'p', pinned: true, importance: 'low', urgency: 'low' })
    const high = todo({ id: 'h', importance: 'high', urgency: 'high', dueAt: '2026-01-11T00:00:00Z' })
    expect(priorityScore(pinned, NOW)).toBeGreaterThan(priorityScore(high, NOW))
  })

  it('已完成/已归档任务沉底', () => {
    expect(priorityScore(todo({ status: 'completed' }), NOW)).toBeLessThan(0)
    expect(priorityScore(todo({ status: 'archived' }), NOW)).toBeLessThan(0)
    expect(explainPriority(todo({ status: 'completed' }), NOW).inactive).toBe(true)
  })

  it('分数构成之和等于总分', () => {
    const b = explainPriority(
      todo({ importance: 'high', urgency: 'low', dueAt: '2026-01-12T09:00:00Z', pinned: false }),
      NOW
    )
    expect(b.importance + b.urgency + b.deadline + b.age + b.pin).toBe(b.total)
  })

  it('评分是确定性的', () => {
    const t = todo({ dueAt: '2026-01-13T09:00:00Z' })
    expect(priorityScore(t, NOW)).toBe(priorityScore(t, NOW))
  })
})

describe('sortByPriority', () => {
  it('按分数从高到低排序', () => {
    const list: Todo[] = [
      todo({ id: 'a', importance: 'low', urgency: 'low' }),
      todo({ id: 'b', importance: 'high', urgency: 'high' }),
      todo({ id: 'c', pinned: true }),
      todo({ id: 'd', status: 'completed' })
    ]
    const sorted = sortByPriority(list, NOW).map((t) => t.id)
    expect(sorted).toEqual(['c', 'b', 'a', 'd'])
  })

  it('同分时创建早的在前', () => {
    const list: Todo[] = [
      todo({ id: 'new', createdAt: '2026-01-05T09:00:00Z' }),
      todo({ id: 'old', createdAt: '2025-12-01T09:00:00Z' })
    ]
    expect(sortByPriority(list, NOW).map((t) => t.id)).toEqual(['old', 'new'])
  })

  it('不修改原数组', () => {
    const list = [todo({ id: 'a' }), todo({ id: 'b', importance: 'high' as Level })]
    const copy = list.map((t) => t.id)
    sortByPriority(list, NOW)
    expect(list.map((t) => t.id)).toEqual(copy)
  })
})
