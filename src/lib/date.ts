import type { Todo } from '@shared/types'

const DAY = 24 * 60 * 60 * 1000

export function startOfDay(d: Date): Date {
  const n = new Date(d)
  n.setHours(0, 0, 0, 0)
  return n
}

export function endOfDay(d: Date): Date {
  const n = new Date(d)
  n.setHours(23, 59, 59, 999)
  return n
}

export function isOverdue(todo: Pick<Todo, 'dueAt' | 'status'>, now = new Date()): boolean {
  return !!todo.dueAt && todo.status === 'active' && new Date(todo.dueAt).getTime() < now.getTime()
}

/** 截止时间的紧凑展示：今天 / 明天 / 昨天 / 3月5日 / 3月5日 14:00 */
export function formatDue(dueAt: string | null, now = new Date()): string {
  if (!dueAt) return ''
  const due = new Date(dueAt)
  if (Number.isNaN(due.getTime())) return ''
  const today = startOfDay(now).getTime()
  const that = startOfDay(due).getTime()
  const diffDays = Math.round((that - today) / DAY)
  const hasTime = due.getHours() !== 0 || due.getMinutes() !== 0

  const time = `${String(due.getHours()).padStart(2, '0')}:${String(due.getMinutes()).padStart(2, '0')}`
  if (diffDays === 0) return hasTime ? `今天 ${time}` : '今天'
  if (diffDays === 1) return hasTime ? `明天 ${time}` : '明天'
  if (diffDays === -1) return hasTime ? `昨天 ${time}` : '昨天'
  const md = `${due.getMonth() + 1}月${due.getDate()}日`
  if (diffDays > 1 && diffDays <= 7) {
    return hasTime ? `周${'日一二三四五六'[due.getDay()]} ${time}` : `周${'日一二三四五六'[due.getDay()]}`
  }
  return hasTime ? `${md} ${time}` : md
}

export function formatCreated(iso: string): string {
  const d = new Date(iso)
  const now = new Date()
  const diff = now.getTime() - d.getTime()
  if (diff < 60_000) return '刚刚'
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} 分钟前`
  if (startOfDay(d).getTime() === startOfDay(now).getTime()) {
    return `今天 ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  }
  return `${d.getMonth() + 1}月${d.getDate()}日`
}

/** ISO 字符串 -> datetime-local 输入值 */
export function toLocalInput(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/** datetime-local 输入值 -> ISO 字符串 */
export function fromLocalInput(value: string): string | null {
  if (!value) return null
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return null
  return d.toISOString()
}

/** 相对截止提示的色调 */
export function dueTone(
  todo: Pick<Todo, 'dueAt' | 'status'>,
  now = new Date()
): 'overdue' | 'soon' | 'normal' | 'none' {
  if (!todo.dueAt || todo.status !== 'active') return 'none'
  const diff = new Date(todo.dueAt).getTime() - now.getTime()
  if (diff < 0) return 'overdue'
  if (diff <= DAY) return 'soon'
  return 'normal'
}

const DAY_MS = DAY
export { DAY_MS }
