import { describe, expect, it } from 'vitest'
import {
  avoidOverlap,
  importanceAt,
  levelsAt,
  packFreeSpots,
  positionForQuadrant,
  quadrantAt,
  urgencyAt
} from '@shared/board'
import { priorityScore } from '@shared/priority'
import type { Todo } from '@shared/types'

describe('白板坐标系', () => {
  it('上=重要，下=不重要', () => {
    expect(importanceAt({ x: 0.5, y: 0 })).toBeGreaterThan(importanceAt({ x: 0.5, y: 0.5 }))
    expect(importanceAt({ x: 0.5, y: 1 })).toBe(0)
  })

  it('右=紧急，左=不紧急', () => {
    expect(urgencyAt({ x: 1, y: 0.5 })).toBeGreaterThan(urgencyAt({ x: 0.5, y: 0.5 }))
    expect(urgencyAt({ x: 0, y: 0.5 })).toBe(0)
  })

  it('四角对应四个象限（右上=紧急·重要）', () => {
    expect(quadrantAt({ x: 0.9, y: 0.1 })).toBe(1) // 右上
    expect(quadrantAt({ x: 0.1, y: 0.1 })).toBe(2) // 左上
    expect(quadrantAt({ x: 0.9, y: 0.9 })).toBe(3) // 右下
    expect(quadrantAt({ x: 0.1, y: 0.9 })).toBe(4) // 左下
  })

  it('连续坐标映射到离散等级：越靠上越重要、越靠右越紧急', () => {
    expect(levelsAt({ x: 0.1, y: 0.1 })).toEqual({ importance: 'high', urgency: 'low' })
    expect(levelsAt({ x: 0.5, y: 0.5 })).toEqual({ importance: 'normal', urgency: 'normal' })
    expect(levelsAt({ x: 0.9, y: 0.9 })).toEqual({ importance: 'low', urgency: 'high' })
  })

  it('象限中心点落在该象限内', () => {
    for (const q of [1, 2, 3, 4] as const) {
      expect(quadrantAt(positionForQuadrant(q))).toBe(q)
    }
  })

  it('自动排布不会给出重叠落点', () => {
    const spots = packFreeSpots([], 12)
    expect(spots).toHaveLength(12)
    const keys = new Set(spots.map((p) => `${Math.round(p.x * 100)}:${Math.round(p.y * 100)}`))
    expect(keys.size).toBe(12)
    for (const p of spots) {
      expect(p.x).toBeGreaterThanOrEqual(0)
      expect(p.x).toBeLessThanOrEqual(1)
      expect(p.y).toBeGreaterThanOrEqual(0)
      expect(p.y).toBeLessThanOrEqual(1)
    }
  })

  it('避让：重叠的落点会被推开', () => {
    const moved = avoidOverlap({ x: 0.5, y: 0.5 }, [{ x: 0.5, y: 0.5 }])
    expect(moved.x === 0.5 && moved.y === 0.5).toBe(false)
  })
})

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
    classified: false,
    order: 0,
    steps: [],
    boardX: null,
    boardY: null,
    ...patch
  }
}

describe('白板位置参与排序', () => {
  const NOW = new Date('2026-01-10T09:00:00Z')

  it('越靠上越重要、越靠右越紧急，分数越高', () => {
    const topLeft = priorityScore(todo({ boardX: 0.05, boardY: 0.05 }), NOW)
    const middle = priorityScore(todo({ boardX: 0.5, boardY: 0.5 }), NOW)
    const bottomRight = priorityScore(todo({ boardX: 0.95, boardY: 0.95 }), NOW)
    expect(topLeft).toBeGreaterThan(middle)
    expect(middle).toBeGreaterThan(bottomRight)
  })

  it('连续移动带来连续变化', () => {
    const a = priorityScore(todo({ boardX: 0.3, boardY: 0.5 }), NOW)
    const b = priorityScore(todo({ boardX: 0.31, boardY: 0.5 }), NOW)
    expect(Math.abs(a - b)).toBeGreaterThan(0)
    expect(Math.abs(a - b)).toBeLessThan(1)
  })
})
