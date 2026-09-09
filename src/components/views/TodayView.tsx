import { useMemo } from 'react'
import { Coffee, Sun } from 'lucide-react'
import type { Todo } from '@shared/types'
import { useTodos } from '@/store/todos'
import { useVisibleTodos } from '@/hooks/useVisibleTodos'
import { groupToday } from '@/lib/visible'
import { TaskCard } from '@/components/task/TaskCard'
import { EmptyState } from '@/components/task/EmptyState'
import { ScrollArea } from '@/components/ui/scroll-area'

const BAND_LABEL: Record<string, { title: string; hint: string }> = {
  now: { title: '现在', hint: '置顶、逾期或真正紧急的事' },
  next: { title: '接下来', hint: '重要但可以更从容' },
  later: { title: '稍后', hint: '有余力再做' }
}

function Band({
  id,
  todos,
  emphasis
}: {
  id: 'now' | 'next' | 'later'
  todos: Todo[]
  emphasis: 'now' | 'next' | null
}) {
  const select = useTodos((s) => s.select)
  const selectedId = useTodos((s) => s.selectedId)
  if (todos.length === 0) return null
  const label = BAND_LABEL[id]

  return (
    <section className="space-y-1">
      <div className="flex items-baseline gap-2 px-1">
        <h2 className="text-2xs font-medium uppercase tracking-wide text-muted-foreground">
          {label.title}
        </h2>
        <span className="text-2xs text-muted-foreground/70">{label.hint}</span>
        <span className="ml-auto text-2xs text-muted-foreground/70">{todos.length}</span>
      </div>
      <div className="space-y-0.5">
        {todos.map((t) => (
          <TaskCard
            key={t.id}
            todo={t}
            variant="list"
            emphasis={emphasis}
            selected={selectedId === t.id}
            onOpen={() => select(t.id)}
          />
        ))}
      </div>
    </section>
  )
}

/** 今天：被策划好的行动队列，而不是全部任务表 */
export function TodayView() {
  const todos = useVisibleTodos()
  const bands = useMemo(() => groupToday(todos), [todos])

  if (todos.length === 0) {
    return (
      <EmptyState
        title="今天没有待办"
        description="用 Ctrl+Shift+Space 快速记下一件事，它会自动出现在这里"
      />
    )
  }

  return (
    <ScrollArea className="flex-1">
      <div className="mx-auto max-w-3xl space-y-5 px-3 py-3">
        <div className="flex items-center gap-2 px-1">
          <Sun className="h-4 w-4 text-muted-foreground" />
          <span className="text-[13px]">这是系统为你排好的顺序，直接从上往下做就行。</span>
        </div>

        <Band id="now" todos={bands.now} emphasis="now" />
        <Band id="next" todos={bands.next} emphasis="next" />
        <Band id="later" todos={bands.later} emphasis={null} />

        {bands.now.length === 0 && bands.next.length === 0 && (
          <div className="flex items-center gap-2 px-1 text-2xs text-muted-foreground">
            <Coffee className="h-3.5 w-3.5" />
            没有紧急事项，按自己的节奏来。
          </div>
        )}
      </div>
    </ScrollArea>
  )
}
