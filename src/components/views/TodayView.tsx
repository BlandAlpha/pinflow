import { useMemo } from 'react'
import { CalendarDays, ChevronRight, Coffee, Flame, Moon } from 'lucide-react'
import type { Todo } from '@shared/types'
import { useTodos } from '@/store/todos'
import { useVisibleTodos } from '@/hooks/useVisibleTodos'
import { groupToday, isInboxTask } from '@/lib/visible'
import { quadrantAt, pointOf } from '@shared/board'
import { QUADRANT_META } from '@shared/quadrant'
import { cn } from '@/lib/utils'
import { CAPTURE_SHORTCUT_LABEL } from '@/lib/shortcut'
import { dueTone, formatDue } from '@/lib/date'
import { EmptyState } from '@/components/task/EmptyState'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Checkbox } from '@/components/ui/checkbox'

type BandId = 'now' | 'next' | 'later'

const BANDS: { id: BandId; title: string; hint: string; dot: string }[] = [
  { id: 'now', title: '现在做', hint: '先处理这些', dot: 'var(--q1)' },
  { id: 'next', title: '接下来', hint: '重要，但可以更从容', dot: 'var(--q2)' },
  { id: 'later', title: '稍后', hint: '有余力再说', dot: 'var(--q4)' }
]

function zoneOf(t: Todo) {
  const p = pointOf(t)
  return QUADRANT_META[quadrantAt(p ?? { x: 0.5, y: 0.5 })]
}

function TodayRow({ todo }: { todo: Todo }) {
  const selectedId = useTodos((s) => s.selectedId)
  const select = useTodos((s) => s.select)
  const toggle = useTodos((s) => s.toggle)
  const toggleStep = useTodos((s) => s.toggleStep)
  const tone = dueTone(todo)
  const zone = zoneOf(todo)
  const visibleSteps = todo.steps.slice(0, 3)
  const hiddenCount = todo.steps.length - visibleSteps.length

  return (
    <div
      onClick={() => select(todo.id)}
      data-selected={selectedId === todo.id || undefined}
      className={cn(
        'group flex cursor-default items-start gap-3 rounded-md px-3 py-2.5 transition-colors',
        selectedId === todo.id ? 'bg-primary/[0.07]' : 'hover:bg-accent/45'
      )}
    >
      <Checkbox
        className="mt-[3px] shrink-0"
        checked={todo.status === 'completed'}
        onClick={(e) => e.stopPropagation()}
        onCheckedChange={() => void toggle(todo.id)}
      />
      <div className="min-w-0 flex-1">
        <div
          className={cn(
            'text-[15px] font-medium leading-6 tracking-[-0.01em]',
            todo.status === 'completed' && 'text-muted-foreground line-through'
          )}
        >
          {todo.title}
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-2xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: zone.dotVar }} />
            {zone.title}
          </span>
          {todo.dueAt && (
            <span
              className={cn(
                'flex items-center gap-1',
                tone === 'overdue' && 'text-destructive',
                tone === 'soon' && 'text-warn'
              )}
            >
              <CalendarDays className="h-3 w-3" />
              {formatDue(todo.dueAt)}
            </span>
          )}
          {todo.tags.slice(0, 3).map((tag) => (
            <span key={tag}>#{tag}</span>
          ))}
        </div>
        {todo.steps.length > 0 && (
          <ul className="mt-1.5 space-y-1">
            {visibleSteps.map((s) => (
              <li key={s.id} className="flex items-center gap-1.5">
                <Checkbox
                  className="h-3.5 w-3.5 shrink-0 rounded-sm"
                  checked={s.completed}
                  onClick={(e) => e.stopPropagation()}
                  onCheckedChange={() => void toggleStep(s.id)}
                />
                <span
                  className={cn(
                    'truncate text-2xs',
                    s.completed ? 'text-muted-foreground line-through' : 'text-foreground/80'
                  )}
                >
                  {s.title}
                </span>
              </li>
            ))}
            {hiddenCount > 0 && (
              <li className="pl-5 text-2xs text-muted-foreground">还有 {hiddenCount} 项…</li>
            )}
          </ul>
        )}
      </div>
      <ChevronRight className="mt-1.5 h-4 w-4 shrink-0 text-muted-foreground/0 transition-colors group-hover:text-muted-foreground/50" />
    </div>
  )
}

function BandCard({
  band,
  todos,
  accent
}: {
  band: (typeof BANDS)[number]
  todos: Todo[]
  accent: boolean
}) {
  if (todos.length === 0) return null
  return (
    <section
      className={cn(
        'overflow-hidden rounded-lg border bg-card',
        accent ? 'border-border' : 'border-border/70'
      )}
    >
      <header className="flex items-center gap-1.5 border-b border-border/70 bg-muted/30 py-1.5 pl-2 pr-3">
        <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: band.dot }} />
        <h2 className="text-[13.5px] font-semibold tracking-tight">{band.title}</h2>
        <span className="text-2xs text-muted-foreground">{band.hint}</span>
        <span className="ml-auto font-mono text-2xs text-muted-foreground">{todos.length}</span>
      </header>
      <div className="divide-y divide-border/60">
        {todos.map((t) => (
          <TodayRow key={t.id} todo={t} />
        ))}
      </div>
    </section>
  )
}

/** 今天：被策划好的行动空间 —— 一眼看懂「现在 / 接下来 / 稍后」 */
export function TodayView() {
  const todos = useVisibleTodos()
  const all = useTodos((s) => s.todos)
  const bands = useMemo(() => groupToday(todos), [todos])

  const active = todos.filter((t) => t.status === 'active')
  const overdue = active.filter((t) => dueTone(t) === 'overdue').length
  const inboxLeft = all.filter((t) => t.status === 'active' && isInboxTask(t)).length
  const totalSteps = active.reduce((n, t) => n + t.steps.length, 0)

  if (active.length === 0) {
    return (
      <EmptyState
        title="今天没有待办"
        description={`用 ${CAPTURE_SHORTCUT_LABEL} 快速记下一件事，它会自动出现在这里`}
      />
    )
  }

  const dateLabel = new Date().toLocaleDateString('zh-CN', {
    month: 'long',
    day: 'numeric',
    weekday: 'long'
  })

  return (
    <ScrollArea className="flex-1">
      <div className="mx-auto w-full max-w-4xl space-y-5 px-6 py-6">
        <header className="space-y-1">
          <p className="text-2xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
            {dateLabel}
          </p>
          <h1 className="text-[28px] font-semibold leading-9 tracking-[-0.02em]">今天</h1>
          <p className="flex items-center gap-3 text-[13px] text-muted-foreground">
            <span>
              待办 <span className="font-medium text-foreground">{active.length}</span> 项
            </span>
            {overdue > 0 && (
              <span className="flex items-center gap-1 text-destructive">
                <Flame className="h-3 w-3" />
                逾期 {overdue}
              </span>
            )}
            {inboxLeft > 0 && <span>收件箱还有 {inboxLeft} 项待归类</span>}
            {totalSteps > 0 && <span>{totalSteps} 个步骤</span>}
          </p>
        </header>

        <div className="space-y-4">
          <BandCard band={BANDS[0]} todos={bands.now} accent />
          <BandCard band={BANDS[1]} todos={bands.next} accent />
          <BandCard band={BANDS[2]} todos={bands.later} accent={false} />
        </div>

        {bands.now.length === 0 && bands.next.length === 0 && (
          <div className="flex items-center gap-2 rounded-lg border border-dashed border-border px-3 py-3 text-[13px] text-muted-foreground">
            <Coffee className="h-4 w-4" />
            没有非做不可的事，按自己的节奏来。
          </div>
        )}

        <p className="flex items-center gap-1.5 px-1 text-2xs text-muted-foreground/70">
          <Moon className="h-3 w-3" />
          顺序由白板位置与截止时间自动排出，拖一拖就能调整
        </p>
      </div>
    </ScrollArea>
  )
}
