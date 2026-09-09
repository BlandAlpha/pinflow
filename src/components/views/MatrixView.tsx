import { useState } from 'react'
import { Inbox } from 'lucide-react'
import type { Quadrant } from '@shared/types'
import { QUADRANTS, QUADRANT_META } from '@shared/quadrant'
import { groupByQuadrant, useVisibleTodos } from '@/hooks/useVisibleTodos'
import { useTodos } from '@/store/todos'
import { cn } from '@/lib/utils'
import { TaskRow } from '@/components/task/TaskRow'
import { EmptyState } from '@/components/task/EmptyState'
import { ScrollArea } from '@/components/ui/scroll-area'

export function MatrixView() {
  const todos = useVisibleTodos()
  const setQuadrant = useTodos((s) => s.setQuadrant)
  const grouped = groupByQuadrant(todos)
  const [dragId, setDragId] = useState<string | null>(null)
  const [hover, setHover] = useState<Quadrant | null>(null)

  if (todos.length === 0) {
    return <EmptyState title="还没有任务" description="先在收件箱添加任务，再拖拽到对应象限" showShortcut />
  }

  return (
    <div className="grid flex-1 grid-cols-2 grid-rows-2 gap-2.5 p-2.5">
      {QUADRANTS.map((q) => {
        const meta = QUADRANT_META[q]
        const list = grouped[q]
        return (
          <div
            key={q}
            onDragOver={(e) => {
              e.preventDefault()
              setHover(q)
            }}
            onDragLeave={() => setHover((h) => (h === q ? null : h))}
            onDrop={(e) => {
              e.preventDefault()
              if (dragId) void setQuadrant(dragId, q)
              setDragId(null)
              setHover(null)
            }}
            className={cn(
              'flex min-h-0 flex-col rounded-lg border bg-card/50 transition-colors',
              hover === q ? 'border-primary/70 bg-primary/5' : 'border-border'
            )}
          >
            <div className="flex shrink-0 items-center gap-2 border-b border-border/70 px-2.5 py-1.5">
              <span className="h-2 w-2 rounded-full" style={{ background: meta.cssVar }} />
              <span className="text-[12px] font-medium">{meta.title}</span>
              <span className="text-[11px] text-muted-foreground">{meta.subtitle}</span>
              <span className="ml-auto rounded bg-secondary px-1.5 font-mono text-[11px] text-muted-foreground">
                {list.length}
              </span>
            </div>
            <ScrollArea className="min-h-0 flex-1">
              <div className="space-y-0.5 p-1.5">
                {list.length === 0 ? (
                  <div className="flex h-full items-center justify-center gap-1 py-6 text-[11px] text-muted-foreground">
                    <Inbox className="h-3.5 w-3.5" />
                    拖拽任务到此象限
                  </div>
                ) : (
                  list.map((t) => (
                    <div
                      key={t.id}
                      draggable
                      onDragStart={() => setDragId(t.id)}
                      onDragEnd={() => {
                        setDragId(null)
                        setHover(null)
                      }}
                      className={cn(dragId === t.id && 'opacity-40')}
                    >
                      <TaskRow todo={t} />
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
          </div>
        )
      })}
    </div>
  )
}
