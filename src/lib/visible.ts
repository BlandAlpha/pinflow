import type { Todo, TodoFilter, ViewKey } from '@shared/types'
import { priorityScore, sortByPriority } from '@shared/priority'

/**
 * 任务是否"未分类"：用户没有主动给它象限/截止/置顶/标签。
 * 未分类任务保留在 Inbox —— 捕获优先，系统代为组织。
 */
export function isInboxTask(todo: Todo): boolean {
  return !todo.classified
}

/** Today 分档阈值（基于优先级分数，确定性） */
export const TODAY_BANDS = { now: 45, next: 28 } as const

export interface TodayBands {
  now: Todo[]
  next: Todo[]
  later: Todo[]
}

/** 把今日队列分成 现在 / 接下来 / 稍后 三档 */
export function groupToday(todos: Todo[], now = new Date()): TodayBands {
  const active = sortByPriority(
    todos.filter((t) => t.status === 'active'),
    now
  )
  const bands: TodayBands = { now: [], next: [], later: [] }
  for (const t of active) {
    const score = priorityScore(t, now)
    if (t.pinned || score >= TODAY_BANDS.now) bands.now.push(t)
    else if (score >= TODAY_BANDS.next) bands.next.push(t)
    else bands.later.push(t)
  }
  return bands
}

function matchesFilter(todo: Todo, f: TodoFilter): boolean {
  if (f.status !== 'all' && todo.status !== f.status) return false

  if (f.tag && !todo.tags.includes(f.tag)) return false

  if (f.keyword) {
    const kw = f.keyword.toLowerCase()
    const hay = `${todo.title} ${todo.notes} ${todo.tags.join(' ')} ${todo.steps
      .map((s) => s.title)
      .join(' ')}`.toLowerCase()
    if (!hay.includes(kw)) return false
  }

  if (f.dueRange !== 'all') {
    if (f.dueRange === 'none') {
      if (todo.dueAt) return false
    } else if (!todo.dueAt) {
      return false
    } else {
      const due = new Date(todo.dueAt).getTime()
      const endOfToday = new Date()
      endOfToday.setHours(23, 59, 59, 999)
      if (f.dueRange === 'overdue' && !(due < Date.now() && todo.status === 'active')) return false
      if (f.dueRange === 'today' && due > endOfToday.getTime()) return false
      if (f.dueRange === 'week') {
        const week = endOfToday.getTime() + 6 * 24 * 3600 * 1000
        if (due > week) return false
      }
    }
  }
  return true
}

function sortAll(list: Todo[], sort: TodoFilter['sort']): Todo[] {
  const copy = [...list]
  switch (sort) {
    case 'created':
      return copy.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    case 'updated':
      return copy.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    case 'due':
      return copy.sort((a, b) => {
        if (!a.dueAt && !b.dueAt) return 0
        if (!a.dueAt) return 1
        if (!b.dueAt) return -1
        return a.dueAt.localeCompare(b.dueAt)
      })
    case 'priority':
    default:
      return sortByPriority(copy)
  }
}

/** 根据视图与筛选条件计算当前应展示的任务列表 */
export function computeVisible(
  todos: Todo[],
  view: ViewKey,
  filter: TodoFilter,
  now = new Date()
): Todo[] {
  switch (view) {
    case 'inbox':
      return todos
        .filter((t) => t.status === 'active' && isInboxTask(t))
        .slice()
        .sort((a, b) => a.order - b.order || b.createdAt.localeCompare(a.createdAt))
    case 'today': {
      const active = todos.filter((t) => t.status === 'active')
      return sortByPriority(active, now)
    }
    case 'matrix':
      // 看板自行拆分为「四象限 + 未分类暂存区」
      return todos
        .filter((t) => t.status === 'active')
        .slice()
        .sort((a, b) => a.order - b.order || b.createdAt.localeCompare(a.createdAt))
    case 'all':
    default: {
      const matched = todos.filter((t) => matchesFilter(t, filter))
      return sortAll(matched, filter.sort)
    }
  }
}
