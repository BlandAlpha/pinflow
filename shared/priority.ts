import type { Level, Todo, TodoStatus } from './types'

/**
 * 优先级评分模块（透明、确定性、可调优）。
 * 不引入任何机器学习或隐式启发式规则，全部权重集中在本文件顶部。
 */

/** —— 可调权重 —— */
export const WEIGHTS = {
  importance: { low: 0, normal: 12, high: 28 } as Record<Level, number>,
  urgency: { low: 0, normal: 10, high: 22 } as Record<Level, number>,
  /** 截止日期贡献 */
  deadline: {
    overdueBase: 30,
    overduePerDay: 2,
    overdueExtraCap: 12,
    within24h: 26,
    within3d: 18,
    within7d: 12,
    within14d: 6,
    later: 2,
    none: 0
  },
  /** 任务"变老"带来的缓慢爬升 */
  age: { perDay: 0.6, cap: 10 },
  /** 手动置顶 */
  pin: 1000,
  /** 已完成 / 已归档沉底 */
  inactivePenalty: -1000
}

export interface ScoreBreakdown {
  total: number
  importance: number
  urgency: number
  deadline: number
  age: number
  pin: number
  inactive: boolean
}

export interface Scorable {
  importance: Level
  urgency: Level
  dueAt: string | null
  createdAt: string
  pinned: boolean
  status?: TodoStatus
  /** 白板坐标（有值时按连续值计分，而不是离散的 low/normal/high） */
  boardX?: number | null
  boardY?: number | null
}

const DAY = 24 * 60 * 60 * 1000

function deadlineScore(dueAt: string | null, now: number): number {
  if (!dueAt) return WEIGHTS.deadline.none
  const due = new Date(dueAt).getTime()
  if (Number.isNaN(due)) return WEIGHTS.deadline.none
  const diff = due - now
  if (diff < 0) {
    const overdueDays = Math.floor(-diff / DAY)
    const extra = Math.min(WEIGHTS.deadline.overdueExtraCap, overdueDays * WEIGHTS.deadline.overduePerDay)
    return WEIGHTS.deadline.overdueBase + extra
  }
  if (diff <= DAY) return WEIGHTS.deadline.within24h
  if (diff <= 3 * DAY) return WEIGHTS.deadline.within3d
  if (diff <= 7 * DAY) return WEIGHTS.deadline.within7d
  if (diff <= 14 * DAY) return WEIGHTS.deadline.within14d
  return WEIGHTS.deadline.later
}

function ageScore(createdAt: string, now: number): number {
  const created = new Date(createdAt).getTime()
  if (Number.isNaN(created)) return 0
  const days = (now - created) / DAY
  if (days <= 0) return 0
  return Math.min(WEIGHTS.age.cap, Math.floor(days * WEIGHTS.age.perDay))
}

/** 计算分数构成，便于 UI 解释与调试 */
export function explainPriority(todo: Scorable, now: Date = new Date()): ScoreBreakdown {
  const t = now.getTime()
  const inactive = todo.status === 'completed' || todo.status === 'archived'
  // 放到白板上的任务按连续坐标计分：越靠上越重要、越靠左越紧急
  const importance =
    todo.boardY != null
      ? WEIGHTS.importance.high * Math.min(1, Math.max(0, 1 - todo.boardY))
      : WEIGHTS.importance[todo.importance]
  const urgency =
    todo.boardX != null
      ? WEIGHTS.urgency.high * Math.min(1, Math.max(0, 1 - todo.boardX))
      : WEIGHTS.urgency[todo.urgency]
  const deadline = deadlineScore(todo.dueAt, t)
  const age = ageScore(todo.createdAt, t)
  const pin = todo.pinned ? WEIGHTS.pin : 0

  if (inactive) {
    return {
      total: WEIGHTS.inactivePenalty + pin,
      importance,
      urgency,
      deadline,
      age,
      pin,
      inactive: true
    }
  }
  return {
    total: importance + urgency + deadline + age + pin,
    importance,
    urgency,
    deadline,
    age,
    pin,
    inactive: false
  }
}

/** 优先级分数（数值越大越应该先做） */
export function priorityScore(todo: Scorable, now: Date = new Date()): number {
  return explainPriority(todo, now).total
}

/** 按优先级降序排序（同分时按创建时间早的在前） */
export function sortByPriority<T extends Scorable>(todos: T[], now: Date = new Date()): T[] {
  return [...todos].sort((a, b) => {
    const sa = priorityScore(a, now)
    const sb = priorityScore(b, now)
    if (sb !== sa) return sb - sa
    return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  })
}

export type { Todo }
