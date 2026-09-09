import { useEffect, useRef, useState } from 'react'
import { Archive, ChevronDown, MoreHorizontal, Plus, Tag, Trash2, X } from 'lucide-react'
import { QUADRANT_META, quadrantOf } from '@shared/quadrant'
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
import { QuadrantPicker } from '@/components/task/QuadrantPicker'
import { DuePicker } from '@/components/task/DuePicker'

const LEVEL_TEXT: Record<string, string> = { high: '高', normal: '中', low: '低' }

/**
 * 任务详情：渐进披露。
 * 默认只有 标题 / 属性行 / 步骤 / 备注，高级信息收在「更多」里。
 */
export function DetailPanel() {
  const todo = useTodos((s) => s.todos.find((t) => t.id === s.selectedId) ?? null)
  const select = useTodos((s) => s.select)
  const update = useTodos((s) => s.update)
  const setQuadrant = useTodos((s) => s.setQuadrant)
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

  const q = quadrantOf(todo)
  const meta = QUADRANT_META[q]
  const score = explainPriority(todo)
  const done = todo.steps.filter((s) => s.completed).length
  const tone = dueTone(todo)

  return (
    <aside className="flex w-[340px] shrink-0 animate-slide-in-right flex-col border-l border-border bg-card/40">
      <div className="flex shrink-0 items-center gap-1 px-3 py-2">
        <span className="text-2xs text-muted-foreground">任务</span>
        <div className="flex-1" />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon-sm" title="更多操作">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
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
        <Button variant="ghost" size="icon-sm" title="关闭 (Esc)" onClick={() => select(null)}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      <ScrollArea className="min-h-0 flex-1">
        <div className="space-y-4 px-3 pb-6">
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
              'w-full bg-transparent text-[15px] font-medium leading-6 outline-none placeholder:text-muted-foreground',
              todo.status === 'completed' && 'text-muted-foreground line-through'
            )}
            placeholder="任务标题"
          />

          {/* 紧凑属性行 */}
          <div className="flex flex-wrap items-center gap-1.5">
            <QuadrantPicker
              value={todo.classified ? q : null}
              onChange={(next) => void setQuadrant(todo.id, next)}
            >
              <button className="flex items-center gap-1.5 rounded-md border border-border px-2 py-1 text-[12px] transition-colors hover:bg-accent">
                <span
                  className="h-1.5 w-1.5 rounded-full"
                  style={{ background: todo.classified ? meta.dotVar : 'hsl(var(--border-strong))' }}
                />
                {todo.classified ? meta.title : '未分类'}
                <ChevronDown className="h-3 w-3 text-muted-foreground" />
              </button>
            </QuadrantPicker>

            <DuePicker
              value={todo.dueAt}
              onChange={(iso) => void update({ id: todo.id, dueAt: iso })}
            >
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

            <div className="flex flex-wrap items-center gap-1">
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
          </div>

          {/* 步骤 */}
          <section className="space-y-1">
            <div className="flex items-center gap-2">
              <h3 className="text-2xs font-medium text-muted-foreground">步骤</h3>
              {todo.steps.length > 0 && (
                <span className="text-2xs text-muted-foreground/70">
                  {done}/{todo.steps.length}
                </span>
              )}
            </div>

            <div className="space-y-0.5">
              {todo.steps.map((step) => (
                <div
                  key={step.id}
                  className="group/step flex items-center gap-2 rounded px-1 py-0.5"
                >
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
                    {step.completed && <span className="h-1.5 w-1.5 rounded-sm bg-primary-foreground" />}
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

            <div className="flex items-center gap-2 pl-1">
              <Plus className="h-3.5 w-3.5 text-muted-foreground" />
              <input
                ref={stepRef}
                value={stepInput}
                onChange={(e) => setStepInput(e.target.value)}
                onKeyDown={async (e) => {
                  if (e.key === 'Enter' && stepInput.trim()) {
                    await addStep(todo.id, stepInput)
                    setStepInput('')
                    stepRef.current?.focus()
                  }
                }}
                placeholder="添加步骤，回车保存"
                className="flex-1 bg-transparent text-[13px] outline-none placeholder:text-muted-foreground"
              />
            </div>
          </section>

          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            onBlur={() => notes !== todo.notes && void update({ id: todo.id, notes })}
            placeholder="备注…"
            className="min-h-[88px] resize-none border-transparent bg-transparent px-1 text-[13px] hover:border-border focus-visible:border-border"
          />

          <Separator />

          <button
            onClick={() => setShowMore((v) => !v)}
            className="flex w-full items-center gap-1 text-2xs text-muted-foreground hover:text-foreground"
          >
            <ChevronDown className={cn('h-3 w-3 transition-transform', showMore && 'rotate-180')} />
            更多
          </button>

          {showMore && (
            <div className="space-y-1 rounded-md bg-muted/50 p-2 text-2xs text-muted-foreground">
              <div className="flex items-center justify-between">
                <span>内部重要度 / 紧急度（由象限推导）</span>
                <span className="font-mono">
                  {LEVEL_TEXT[todo.importance]} / {LEVEL_TEXT[todo.urgency]}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span>
                  优先级构成 · 重要 {score.importance} 紧急 {score.urgency} 截止 {score.deadline} 陈旧{' '}
                  {score.age}
                </span>
                <span className="font-mono">{score.total}</span>
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
