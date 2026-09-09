import { memo, useState } from 'react'
import { ListChecks, Pin, PinOff } from 'lucide-react'
import type { Todo } from '@shared/types'
import { QUADRANT_META, quadrantOf } from '@shared/quadrant'
import { useTodos } from '@/store/todos'
import { cn } from '@/lib/utils'
import { dueTone, formatDue } from '@/lib/date'
import { Checkbox } from '@/components/ui/checkbox'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { QuadrantPicker } from '@/components/task/QuadrantPicker'
import { DueBadge, DuePicker } from '@/components/task/DuePicker'
import { InlineSteps } from '@/components/task/InlineSteps'

export interface TaskCardProps {
  todo: Todo
  /** list = 列表式（收件箱/今天）；board = 卡片式（四象限看板） */
  variant?: 'list' | 'board'
  selected?: boolean
  onOpen?: () => void
  draggable?: boolean
  onDragStart?: (e: React.DragEvent) => void
  onDragEnd?: (e: React.DragEvent) => void
  dragging?: boolean
  /** 是否显示优先级提示（Today） */
  emphasis?: 'now' | 'next' | null
}

/** 统一的任务卡片语言：列表态扁平、看板态更像便签 */
export const TaskCard = memo(function TaskCard({
  todo,
  variant = 'list',
  selected = false,
  onOpen,
  draggable = false,
  onDragStart,
  onDragEnd,
  dragging = false,
  emphasis = null
}: TaskCardProps) {
  const toggle = useTodos((s) => s.toggle)
  const togglePin = useTodos((s) => s.togglePin)
  const setQuadrant = useTodos((s) => s.setQuadrant)
  const update = useTodos((s) => s.update)
  const [stepsOpen, setStepsOpen] = useState(false)

  const q = quadrantOf(todo)
  const meta = QUADRANT_META[q]
  const done = todo.steps.filter((s) => s.completed).length
  const tone = dueTone(todo) === 'none' ? 'normal' : dueTone(todo)
  const completed = todo.status === 'completed'

  const card = (
    <div
      data-selected={selected || undefined}
      data-dragging={dragging || undefined}
      data-flat={variant === 'list' || undefined}
      draggable={draggable}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onClick={() => onOpen?.()}
      className={cn(
        'task-card group cursor-default select-none',
        variant === 'board' ? 'space-y-1.5 p-2.5' : 'flex items-center gap-2 px-2 py-1.5',
        completed && 'opacity-55',
        variant === 'list' && !selected && 'hover:bg-accent/50'
      )}
    >
      <Checkbox
        className="app-no-drag shrink-0"
        checked={completed}
        onClick={(e) => e.stopPropagation()}
        onCheckedChange={() => void toggle(todo.id)}
      />

      <div className="min-w-0 flex-1">
        <div className="flex items-start gap-1.5">
          {todo.pinned && (
            <Pin className="mt-0.5 h-3 w-3 shrink-0 text-primary" fill="currentColor" />
          )}
          {emphasis === 'now' && !todo.pinned && (
            <span
              className="mt-1 h-3 w-0.5 shrink-0 rounded-full bg-primary"
              title="建议现在处理"
            />
          )}
          <span
            className={cn(
              'min-w-0 flex-1 text-[13px] leading-5',
              variant === 'board' ? 'line-clamp-2' : 'truncate',
              completed && 'text-muted-foreground line-through'
            )}
          >
            {todo.title}
          </span>
        </div>

        {/* 次要信息：安静、只在有内容时出现 */}
        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
          <QuadrantPicker
            value={todo.classified ? q : null}
            onChange={(next) => void setQuadrant(todo.id, next)}
          >
            <button
              onClick={(e) => e.stopPropagation()}
              className="flex items-center gap-1 rounded px-1 py-px text-2xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              title={todo.classified ? `${meta.title} · 点击更换` : '未分类 · 点击选择象限'}
            >
              <span
                className="h-1.5 w-1.5 rounded-full"
                style={{ background: todo.classified ? meta.dotVar : 'hsl(var(--border-strong))' }}
              />
              {todo.classified ? meta.action : '未分类'}
            </button>
          </QuadrantPicker>

          {todo.dueAt && (
            <DuePicker value={todo.dueAt} onChange={(iso) => void update({ id: todo.id, dueAt: iso })}>
              <button onClick={(e) => e.stopPropagation()} className="app-no-drag">
                <DueBadge value={todo.dueAt} tone={tone} label={formatDue(todo.dueAt)} />
              </button>
            </DuePicker>
          )}

          {todo.steps.length > 0 && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                setStepsOpen((v) => !v)
              }}
              className={cn(
                'flex items-center gap-1 rounded px-1 py-px text-2xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground',
                stepsOpen && 'bg-accent text-foreground'
              )}
              title={stepsOpen ? '收起步骤' : '展开步骤'}
            >
              <ListChecks className="h-3 w-3" />
              {done}/{todo.steps.length}
            </button>
          )}

          {todo.tags.slice(0, 2).map((tag) => (
            <span key={tag} className="text-2xs text-muted-foreground/80">
              #{tag}
            </span>
          ))}
        </div>

        {stepsOpen && <InlineSteps todo={todo} />}
      </div>

      {/* 悬停操作：置顶 */}
      <Button
        variant="ghost"
        size="icon-sm"
        className={cn(
          'app-no-drag h-6 w-6 shrink-0 transition-opacity',
          todo.pinned ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
        )}
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

  if (variant === 'list') return card

  return (
    <Tooltip>
      <TooltipTrigger asChild>{card}</TooltipTrigger>
      <TooltipContent side="bottom" align="start" className="max-w-[240px] space-y-0.5">
        <div className="font-medium">{todo.title}</div>
        <div className="text-muted-foreground">
          {todo.classified ? meta.title : '未分类'} · {meta.action}
        </div>
        {todo.dueAt && <div className="text-muted-foreground">截止 {formatDue(todo.dueAt)}</div>}
      </TooltipContent>
    </Tooltip>
  )
})
