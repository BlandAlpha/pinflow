import { memo } from 'react'
import { Pin, PinOff, ListChecks, Flag } from 'lucide-react'
import type { Todo } from '@shared/types'
import { quadrantOf, QUADRANT_META } from '@shared/quadrant'
import { explainPriority } from '@shared/priority'
import { cn } from '@/lib/utils'
import { formatDue, dueTone } from '@/lib/date'
import { useTodos } from '@/store/todos'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

const LEVEL_LABEL: Record<string, string> = {
  high: '高',
  normal: '中',
  low: '低'
}

export interface TaskRowProps {
  todo: Todo
  selected?: boolean
  showScore?: boolean
  onOpen?: (todo: Todo) => void
  onKeyDownRow?: (e: React.KeyboardEvent, todo: Todo) => void
}

export const TaskRow = memo(function TaskRow({
  todo,
  selected = false,
  showScore = false,
  onOpen
}: TaskRowProps) {
  const toggle = useTodos((s) => s.toggle)
  const togglePin = useTodos((s) => s.togglePin)
  const select = useTodos((s) => s.select)
  const selectedId = useTodos((s) => s.selectedId)

  const q = quadrantOf(todo)
  const meta = QUADRANT_META[q]
  const tone = dueTone(todo)
  const doneSteps = todo.steps.filter((s) => s.completed).length
  const score = explainPriority(todo)

  return (
    <div
      role="button"
      tabIndex={-1}
      onClick={() => {
        select(todo.id)
        onOpen?.(todo)
      }}
      className={cn(
        'group flex w-full cursor-default items-center gap-2 rounded-md border border-transparent px-2 py-1.5 text-left transition-colors hover:bg-accent/60',
        selected && todo.id === selectedId ? 'border-ring/40 bg-accent' : '',
        todo.status === 'completed' && 'opacity-55'
      )}
    >
      <span
        className="h-2 w-2 shrink-0 rounded-full"
        style={{ background: meta.cssVar }}
        title={`${meta.title}`}
      />

      <Checkbox
        className="app-no-drag"
        checked={todo.status === 'completed'}
        onClick={(e) => e.stopPropagation()}
        onCheckedChange={() => void toggle(todo.id)}
      />

      <span
        className={cn(
          'min-w-0 flex-1 truncate text-[13px]',
          todo.status === 'completed' && 'line-through text-muted-foreground'
        )}
      >
        {todo.title}
      </span>

      {todo.pinned && <Pin className="h-3 w-3 shrink-0 text-primary" fill="currentColor" />}

      {todo.steps.length > 0 && (
        <span className="flex shrink-0 items-center gap-0.5 text-[11px] text-muted-foreground">
          <ListChecks className="h-3 w-3" />
          {doneSteps}/{todo.steps.length}
        </span>
      )}

      {todo.tags.slice(0, 2).map((tag) => (
        <Badge key={tag} variant="outline" className="shrink-0">
          #{tag}
        </Badge>
      ))}

      {(todo.importance !== 'normal' || todo.urgency !== 'normal') && (
        <span className="flex shrink-0 items-center gap-1 text-[11px] text-muted-foreground">
          {todo.importance !== 'normal' && (
            <span
              className={cn(
                'flex items-center gap-0.5',
                todo.importance === 'high' ? 'text-red-400' : 'text-muted-foreground'
              )}
            >
              <Flag className="h-3 w-3" />
              {LEVEL_LABEL[todo.importance]}
            </span>
          )}
        </span>
      )}

      {todo.dueAt && (
        <Badge
          variant={tone === 'overdue' ? 'danger' : tone === 'soon' ? 'warn' : 'outline'}
          className="shrink-0"
        >
          {tone === 'overdue' ? '逾期 ' : ''}
          {formatDue(todo.dueAt)}
        </Badge>
      )}

      {showScore && (
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="shrink-0 rounded bg-secondary px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground">
              {score.total}
            </span>
          </TooltipTrigger>
          <TooltipContent side="left" className="space-y-0.5">
            <div className="font-medium">优先级 {score.total}</div>
            <div>重要度 {score.importance}</div>
            <div>紧急度 {score.urgency}</div>
            <div>截止 {score.deadline}</div>
            <div>陈旧 {score.age}</div>
            {score.pin > 0 && <div>置顶 {score.pin}</div>}
          </TooltipContent>
        </Tooltip>
      )}

      <Button
        variant="ghost"
        size="icon-sm"
        className="h-6 w-6 shrink-0 opacity-0 transition-opacity group-hover:opacity-100"
        title={todo.pinned ? '取消置顶' : '置顶'}
        onClick={(e) => {
          e.stopPropagation()
          void togglePin(todo.id)
        }}
      >
        {todo.pinned ? <PinOff className="h-3.5 w-3.5" /> : <Pin className="h-3.5 w-3.5" />}
      </Button>
    </div>
  )
})
