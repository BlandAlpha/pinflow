import type { Todo } from '@shared/types'
import { useVisibleTodos } from '@/hooks/useVisibleTodos'
import { TaskRow } from '@/components/task/TaskRow'
import { EmptyState } from '@/components/task/EmptyState'
import { ScrollArea } from '@/components/ui/scroll-area'

export function ListView({ showScore = false }: { showScore?: boolean }) {
  const todos = useVisibleTodos()

  if (todos.length === 0) {
    return (
      <EmptyState
        title="这里还没有任务"
        description="按 N 或使用上方输入框创建第一个任务"
        showShortcut
      />
    )
  }

  return (
    <ScrollArea className="flex-1">
      <div className="space-y-0.5 p-2">
        {todos.map((t: Todo) => (
          <TaskRow key={t.id} todo={t} showScore={showScore} />
        ))}
      </div>
    </ScrollArea>
  )
}
