import { useTodos } from '@/store/todos'
import { useVisibleTodos } from '@/hooks/useVisibleTodos'
import { QuickAdd } from '@/components/task/QuickAdd'
import { TaskCard } from '@/components/task/TaskCard'
import { EmptyState } from '@/components/task/EmptyState'
import { ScrollArea } from '@/components/ui/scroll-area'

/** 收件箱 = 分诊台：只做「完成 / 打开 / 分类」，不暴露大表单 */
export function InboxView() {
  const todos = useVisibleTodos()
  const select = useTodos((s) => s.select)
  const selectedId = useTodos((s) => s.selectedId)

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="shrink-0 border-b border-border px-3 py-2.5">
        <QuickAdd />
        <p className="mt-1.5 px-0.5 text-2xs text-muted-foreground">
          只管记下来。给它一个象限或截止时间后，它会自己离开收件箱。
        </p>
      </div>

      {todos.length === 0 ? (
        <EmptyState
          title="收件箱是空的"
          description="Ctrl+Shift+Space 随时记下一件事，稍后再来整理"
        />
      ) : (
        <ScrollArea className="flex-1">
          <div className="mx-auto max-w-3xl space-y-0.5 px-2 py-2">
            {todos.map((t) => (
              <TaskCard
                key={t.id}
                todo={t}
                variant="list"
                selected={selectedId === t.id}
                onOpen={() => select(t.id)}
              />
            ))}
          </div>
        </ScrollArea>
      )}
    </div>
  )
}
