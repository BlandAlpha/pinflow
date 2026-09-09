import type { Level, Quadrant, QuadrantValue, Todo } from './types'

/** 重要 / 紧急 的二分判定：high = 是，其余 = 否 */
export function isImportant(level: Level): boolean {
  return level === 'high'
}

/** 象限编号 -> importance / urgency */
export function quadrantToLevels(q: Quadrant): QuadrantValue {
  const important = q === 1 || q === 2
  const urgent = q === 1 || q === 3
  return {
    importance: important ? 'high' : 'normal',
    urgency: urgent ? 'high' : 'normal'
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

export const QUADRANT_META: Record<
  Quadrant,
  { title: string; subtitle: string; hint: string; cssVar: string }
> = {
  1: {
    title: '重要且紧急',
    subtitle: '马上做',
    hint: '立即处理',
    cssVar: 'var(--q1)'
  },
  2: {
    title: '重要不紧急',
    subtitle: '计划做',
    hint: '排期进行',
    cssVar: 'var(--q2)'
  },
  3: {
    title: '不重要但紧急',
    subtitle: '委托/快速做',
    hint: '快速清掉',
    cssVar: 'var(--q3)'
  },
  4: {
    title: '不重要不紧急',
    subtitle: '少做或删除',
    hint: '考虑删除',
    cssVar: 'var(--q4)'
  }
}

export const QUADRANTS: Quadrant[] = [1, 2, 3, 4]
