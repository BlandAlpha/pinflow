import type { Todo, TodoFilter, ViewKey } from '@shared/types'
import { sortByPriority } from '@shared/priority'

/**
 * 任务是否"未分类"：重要度/紧急度均为默认值、且没有截止日期。
 * 满足该条件的任务保留在 Inbox。
 */
export function isInboxTask(todo: Todo): boolean {
  return (
    todo.importance === 'normal' && todo.urgency === 'normal' && !todo.dueAt
  )
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
      const now = new Date()
      const endOfToday = new Date(now)
      endOfToday.setHours(23, 59, 59, 999)
      if (f.dueRange === 'overdue' && !(due < now.getTime() && todo.status === 'active')) return false
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
export function computeVisible(todos: Todo[], view: ViewKey, filter: TodoFilter, now = new Date()): Todo[] {
  switch (view) {
    case 'inbox':
      return todos.filter((t) => t.status === 'active' && isInboxTask(t)).reverse()
    case 'today': {
      const active = todos.filter((t) => t.status === 'active')
      return sortByPriority(active, now)
    }
    case 'matrix':
      return todos.filter((t) => t.status === 'active')
    case 'all':
    default: {
      const matched = todos.filter((t) => matchesFilter(t, filter))
      return sortAll(matched, filter.sort)
    }
  }
}
