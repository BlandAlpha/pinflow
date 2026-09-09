import { useMemo } from 'react'
import type { Quadrant, Todo } from '@shared/types'
import { quadrantOf, QUADRANTS } from '@shared/quadrant'
import { useTodos } from '@/store/todos'
import { computeVisible } from '@/lib/visible'

export function useVisibleTodos(): Todo[] {
  const todos = useTodos((s) => s.todos)
  const view = useTodos((s) => s.view)
  const filter = useTodos((s) => s.filter)
  return useMemo(() => computeVisible(todos, view, filter), [todos, view, filter])
}

export function groupByQuadrant(todos: Todo[]): Record<Quadrant, Todo[]> {
  const result: Record<Quadrant, Todo[]> = { 1: [], 2: [], 3: [], 4: [] }
  for (const q of QUADRANTS) result[q] = []
  for (const t of todos) result[quadrantOf(t)].push(t)
  return result
}
