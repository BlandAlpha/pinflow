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
