import type { Level, Quadrant, QuadrantValue, Todo } from './types'

/** 重要 / 紧急 的二分判定：high = 是，其余 = 否 */
export function isImportant(level: Level): boolean {
  return level === 'high'
}

/**
 * 象限 -> 内部重要度/紧急度。
 * 面向用户的分类只有「象限」，这两个值由象限自动推导，用于优先级评分。
 */
export function quadrantToLevels(q: Quadrant): QuadrantValue {
  const important = q === 1 || q === 2
  const urgent = q === 1 || q === 3
  return {
    importance: important ? 'high' : 'low',
    urgency: urgent ? 'high' : 'low'
  }
}

/** importance / urgency -> 象限编号 */
export function levelsToQuadrant(importance: Level, urgency: Level): Quadrant {
  const important = isImportant(importance)
  const urgent = isImportant(urgency)
  if (important && urgent) return 1
  if (important && !urgent) return 2
  if (!important && urgent) return 3
  return 4
}

export function quadrantOf(todo: Pick<Todo, 'importance' | 'urgency'>): Quadrant {
  return levelsToQuadrant(todo.importance, todo.urgency)
}

export interface QuadrantMeta {
  title: string
  /** 语义副标题 */
  action: string
  /** 简短说明 */
  hint: string
  /** 极淡的表面色调变量 */
  tintVar: string
  /** 强调点颜色变量（低饱和） */
  dotVar: string
}

export const QUADRANT_META: Record<Quadrant, QuadrantMeta> = {
  1: {
    title: '重要且紧急',
    action: '现在就做',
    hint: '立即处理',
    tintVar: 'var(--q1-tint)',
    dotVar: 'var(--q1)'
  },
  2: {
    title: '重要不紧急',
    action: '计划安排',
    hint: '排期推进',
    tintVar: 'var(--q2-tint)',
    dotVar: 'var(--q2)'
  },
  3: {
    title: '不重要但紧急',
    action: '快速清掉',
    hint: '尽快处理或委托',
    tintVar: 'var(--q3-tint)',
    dotVar: 'var(--q3)'
  },
  4: {
    title: '不重要不紧急',
    action: '以后再说',
    hint: '有空再做或删掉',
    tintVar: 'var(--q4-tint)',
    dotVar: 'var(--q4)'
  }
}

export const QUADRANTS: Quadrant[] = [1, 2, 3, 4]

/**
 * 截止时间 -> 重要度/紧急度：剩余越少越重要越紧急。
 * 档位以 6 小时为最小步长；主进程启动时与每 6 小时按此重算一次。
 */
export function levelsFromDue(
  dueAt: string,
  now: number = Date.now()
): { importance: Level; urgency: Level } {
  const hours = (new Date(dueAt).getTime() - now) / 3_600_000
  // 6 小时内到期（含已逾期）：现在就做
  if (hours <= 6) return { importance: 'high', urgency: 'high' }
  // 一天内：重要，尽早安排
  if (hours <= 24) return { importance: 'high', urgency: 'normal' }
  // 三天内：正常推进
  if (hours <= 72) return { importance: 'normal', urgency: 'normal' }
  // 一周内：先不抢注意力
  if (hours <= 168) return { importance: 'normal', urgency: 'low' }
  // 还远
  return { importance: 'low', urgency: 'low' }
}
