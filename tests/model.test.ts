import { describe, expect, it } from 'vitest'
import { quadrantToLevels, levelsToQuadrant, quadrantOf } from '@shared/quadrant'
import type { Quadrant } from '@shared/types'
import { groupToday, isInboxTask, TODAY_BANDS } from '@/lib/visible'
import type { Todo } from '@shared/types'

function todo(patch: Partial<Todo> = {}): Todo {
  return {
    id: Math.random().toString(36).slice(2),
    title: 'test',
    notes: '',
    importance: 'low',
    urgency: 'low',
    dueAt: null,
    status: 'active',
    createdAt: '2026-01-01T09:00:00Z',
    updatedAt: '2026-01-01T09:00:00Z',
    completedAt: null,
    tags: [],
    pinned: false,
    classified: false,
    order: 0,
    steps: [],
    boardX: null,
    boardY: null,
    ...patch
  }
}

describe('象限是面向用户的唯一分类', () => {
  it('象限自动推导内部重要度/紧急度', () => {
    expect(quadrantToLevels(1)).toEqual({ importance: 'high', urgency: 'high' })
    expect(quadrantToLevels(2)).toEqual({ importance: 'high', urgency: 'low' })
    expect(quadrantToLevels(3)).toEqual({ importance: 'low', urgency: 'high' })
    expect(quadrantToLevels(4)).toEqual({ importance: 'low', urgency: 'low' })
  })

  it('象限与内部值可双向映射', () => {
    const all: Quadrant[] = [1, 2, 3, 4]
    for (const q of all) {
      const { importance, urgency } = quadrantToLevels(q)
      expect(levelsToQuadrant(importance, urgency)).toBe(q)
    }
  })

  it('优先级：重要且紧急 > 重要不紧急 > 不重要但紧急 > 不重要不紧急', () => {
    const byQ = (q: Quadrant) => {
      const t = todo({ ...quadrantToLevels(q), classified: true })
      return quadrantOf(t)
    }
    expect([byQ(1), byQ(2), byQ(3), byQ(4)]).toEqual([1, 2, 3, 4])
  })
})

describe('收件箱 = 未分类', () => {
  it('未设置任何属性的任务留在收件箱', () => {
    expect(isInboxTask(todo())).toBe(true)
  })

  it('一旦分类就离开收件箱', () => {
    expect(isInboxTask(todo({ classified: true }))).toBe(false)
  })
})

describe('今天分档', () => {
  const now = new Date('2026-01-10T09:00:00Z')

  it('置顶任务即使没有其他属性也进入「现在」', () => {
    const bands = groupToday([todo({ pinned: true })], now)
    expect(bands.now).toHaveLength(1)
    expect(bands.now[0].pinned).toBe(true)
  })

  it('重要且紧急进入「现在」，重要不紧急进入「接下来」', () => {
    const bands = groupToday(
      [
        todo({ ...quadrantToLevels(2), classified: true }),
        todo({ ...quadrantToLevels(1), classified: true }),
        todo({ ...quadrantToLevels(4), classified: true })
      ],
      now
    )
    expect(bands.now).toHaveLength(1)
    expect(bands.next).toHaveLength(1)
    expect(bands.later).toHaveLength(1)
  })

  it('逾期任务至少进入「接下来」', () => {
    const bands = groupToday(
      [todo({ dueAt: '2026-01-08T09:00:00Z', classified: true })],
      now
    )
    expect(bands.next.length + bands.now.length).toBe(1)
  })

  it('三档包含全部进行中任务，且已完成任务不出现', () => {
    const list = [
      todo({ ...quadrantToLevels(1), classified: true }),
      todo({ ...quadrantToLevels(3), classified: true }),
      todo({ status: 'completed' })
    ]
    const bands = groupToday(list, now)
    expect(bands.now.length + bands.next.length + bands.later.length).toBe(2)
  })

  it('阈值可预期', () => {
    expect(TODAY_BANDS.now).toBeGreaterThan(TODAY_BANDS.next)
  })
})
