import { useEffect, useRef, useState } from 'react'
import { Archive, ChevronDown, MoreHorizontal, Plus, Tag, Trash2, X } from 'lucide-react'
import { pointOf, quadrantAt } from '@shared/board'
import { QUADRANT_META } from '@shared/quadrant'
import { explainPriority } from '@shared/priority'
import { useTodos } from '@/store/todos'
import { cn } from '@/lib/utils'
import { dueTone, formatDue } from '@/lib/date'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { PriorityPicker } from '@/components/task/PriorityPicker'
import { DuePicker } from '@/components/task/DuePicker'

/**
 * 任务详情：一个安静的侧边编辑器。
 * 标题在最上，2D 优先级选择器是唯一的优先级入口，步骤是主角，
 * 备注与高级信息退到后面，危险操作收进菜单。
 */
export function DetailPanel() {
  const todo = useTodos((s) => s.todos.find((t) => t.id === s.selectedId) ?? null)
  const select = useTodos((s) => s.select)
  const update = useTodos((s) => s.update)
  const setPosition = useTodos((s) => s.setPosition)
  const addTag = useTodos((s) => s.addTag)
  const removeTag = useTodos((s) => s.removeTag)
  const archive = useTodos((s) => s.archive)
  const remove = useTodos((s) => s.remove)
  const addStep = useTodos((s) => s.addStep)
  const toggleStep = useTodos((s) => s.toggleStep)
  const updateStep = useTodos((s) => s.updateStep)
  const deleteStep = useTodos((s) => s.deleteStep)

  const [title, setTitle] = useState('')
  const [notes, setNotes] = useState('')
  const [tagInput, setTagInput] = useState('')
  const [stepInput, setStepInput] = useState('')
  const [showMore, setShowMore] = useState(false)
  const stepRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (todo) {
      setTitle(todo.title)
      setNotes(todo.notes)
      setShowMore(false)
    }
  }, [todo?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!todo) return null

  const point = pointOf(todo)
  const zone = QUADRANT_META[quadrantAt(point ?? { x: 0.5, y: 0.62 })]
  const score = explainPriority(todo)
  const done = todo.steps.filter((s) => s.completed).length
  const tone = dueTone(todo)

  const addStepNow = async () => {
    const v = stepInput.trim()
    if (!v) return
    await addStep(todo.id, v)
    setStepInput('')
    stepRef.current?.focus()
  }

  return (
    <aside className="flex w-[360px] shrink-0 animate-slide-in-right flex-col border-l border-border bg-card/40">
      <div className="flex shrink-0 items-center gap-1 px-3 py-2">
        <span className="text-2xs text-muted-foreground">任务</span>
        <div className="flex-1" />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon-sm" className="text-muted-foreground" title="更多操作">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={() => void archive(todo.id)}>
              <Archive className="h-3.5 w-3.5" />
              归档（可撤销）
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem destructive onSelect={() => void remove(todo.id)}>
              <Trash2 className="h-3.5 w-3.5" />
              删除（可撤销）
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <Button
          variant="ghost"
          size="icon-sm"
          className="text-muted-foreground"
          title="关闭 (Esc)"
          onClick={() => select(null)}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      <ScrollArea className="min-h-0 flex-1">
        <div className="space-y-5 px-4 pb-8">
          {/* 标题 */}
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={() => {
              const t = title.trim()
              if (t && t !== todo.title) void update({ id: todo.id, title: t })
              else setTitle(todo.title)
            }}
            onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
            className={cn(
              'w-full bg-transparent text-[17px] font-semibold leading-7 tracking-[-0.01em] outline-none placeholder:text-muted-foreground/70',
              todo.status === 'completed' && 'text-muted-foreground line-through'
            )}
            placeholder="任务标题"
          />

          {/* 紧凑属性行 */}
          <div className="flex flex-wrap items-center gap-1.5">
            <DuePicker value={todo.dueAt} onChange={(iso) => void update({ id: todo.id, dueAt: iso })}>
              <button
                className={cn(
                  'flex items-center gap-1.5 rounded-md border border-border px-2 py-1 text-[12px] transition-colors hover:bg-accent',
                  !todo.dueAt && 'text-muted-foreground',
                  tone === 'overdue' && 'text-destructive',
                  tone === 'soon' && 'text-warn'
                )}
              >
                {todo.dueAt ? formatDue(todo.dueAt) : '设置截止'}
              </button>
            </DuePicker>

            <span
              className="flex items-center gap-1.5 rounded-md border border-transparent px-1.5 py-1 text-[12px] text-muted-foreground"
              title={point ? zone.title : '尚未放到白板上'}
            >
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: zone.dotVar }} />
              {point ? zone.title : '待归类'}
            </span>

            {todo.tags.map((t) => (
              <span
                key={t}
                className="flex items-center gap-1 rounded-md bg-secondary px-1.5 py-1 text-[12px] text-muted-foreground"
              >
                #{t}
                <button
                  onClick={() => void removeTag(todo.id, t)}
                  className="rounded-full hover:text-destructive"
                >
                  <X className="h-2.5 w-2.5" />
                </button>
              </span>
            ))}
            <span className="relative flex items-center">
              <Tag className="pointer-events-none absolute left-1.5 h-3 w-3 text-muted-foreground" />
              <input
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && tagInput.trim()) {
                    void addTag(todo.id, tagInput)
                    setTagInput('')
                  }
                  if (e.key === 'Escape') setTagInput('')
                }}
                placeholder="标签"
                className="h-7 w-20 rounded-md border border-transparent bg-transparent pl-6 pr-1 text-[12px] outline-none placeholder:text-muted-foreground hover:border-border focus:border-border"
              />
            </span>
          </div>

          {/* 优先级：唯一的手动入口 */}
          <section className="space-y-2">
            <div className="flex items-baseline gap-2">
              <h3 className="text-2xs font-medium text-muted-foreground">优先级</h3>
              <span className="text-2xs text-muted-foreground/60">拖动选点</span>
            </div>
            <PriorityPicker
              value={point}
              onChange={(p) => void setPosition(todo.id, p.x, p.y)}
              size={148}
            />
          </section>

          <Separator />

          {/* 步骤 */}
          <section className="space-y-1.5">
            <div className="flex items-center gap-2">
              <h3 className="text-[13px] font-semibold tracking-tight">步骤</h3>
              {todo.steps.length > 0 && (
                <span className="font-mono text-2xs text-muted-foreground">
                  {done}/{todo.steps.length}
                </span>
              )}
            </div>

            <div className="space-y-0.5">
              {todo.steps.map((step) => (
                <div key={step.id} className="group/step flex items-center gap-2 rounded px-1 py-1">
                  <button
                    onClick={() => void toggleStep(step.id)}
                    className={cn(
                      'flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded border transition-colors',
                      step.completed
                        ? 'border-primary bg-primary'
                        : 'border-border-strong hover:border-primary'
                    )}
                    title={step.completed ? '标记未完成' : '标记完成'}
                  >
                    {step.completed && (
                      <span className="h-1.5 w-1.5 rounded-sm bg-primary-foreground" />
                    )}
                  </button>
                  <input
                    key={`${step.id}-${step.title}`}
                    defaultValue={step.title}
                    onBlur={(e) => {
                      const v = e.target.value.trim()
                      if (v && v !== step.title) void updateStep(step.id, { title: v })
                    }}
                    onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
                    className={cn(
                      'flex-1 bg-transparent text-[13px] outline-none',
                      step.completed && 'text-muted-foreground line-through'
                    )}
                  />
                  <button
                    onClick={() => void deleteStep(step.id)}
                    className="rounded p-0.5 text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover/step:opacity-100"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>

            <div className="flex items-center gap-2 rounded-md border border-border px-2 py-1.5 focus-within:border-primary/60">
              <Plus className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <input
                ref={stepRef}
                value={stepInput}
                onChange={(e) => setStepInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    void addStepNow()
                  }
                }}
                placeholder="添加步骤，回车继续"
                className="flex-1 bg-transparent text-[13px] outline-none placeholder:text-muted-foreground"
              />
            </div>
          </section>

          {/* 备注：次要 */}
          <section className="space-y-1">
            <h3 className="text-2xs font-medium text-muted-foreground">备注</h3>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              onBlur={() => notes !== todo.notes && void update({ id: todo.id, notes })}
              placeholder="补充信息…"
              className="min-h-[68px] resize-none border-transparent bg-transparent px-1 text-[13px] text-muted-foreground hover:border-border focus-visible:border-border"
            />
          </section>

          <button
            onClick={() => setShowMore((v) => !v)}
            className="flex w-full items-center gap-1 text-2xs text-muted-foreground/70 hover:text-foreground"
          >
            <ChevronDown className={cn('h-3 w-3 transition-transform', showMore && 'rotate-180')} />
            更多
          </button>

          {showMore && (
            <div className="space-y-1 rounded-md bg-muted/50 p-2 text-2xs text-muted-foreground">
              <div className="flex items-center justify-between">
                <span>优先级构成 · 重要 {Math.round(score.importance)} 紧急{' '}
                  {Math.round(score.urgency)} 截止 {score.deadline} 陈旧 {score.age}</span>
                <span className="font-mono">{Math.round(score.total)}</span>
              </div>
              <div>创建 {new Date(todo.createdAt).toLocaleString('zh-CN', { hour12: false })}</div>
              <div>更新 {new Date(todo.updatedAt).toLocaleString('zh-CN', { hour12: false })}</div>
            </div>
          )}
        </div>
      </ScrollArea>
    </aside>
  )
}
