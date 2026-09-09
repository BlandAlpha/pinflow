import { useEffect, useRef, useState } from 'react'
import { Archive, CalendarDays, Plus, Tag, Trash2, X } from 'lucide-react'
import type { Level } from '@shared/types'
import { QUADRANTS, QUADRANT_META, levelsToQuadrant } from '@shared/quadrant'
import { useTodos } from '@/store/todos'
import { cn } from '@/lib/utils'
import { fromLocalInput, toLocalInput } from '@/lib/date'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { TooltipProvider } from '@/components/ui/tooltip'

const LEVELS: { value: Level; label: string }[] = [
  { value: 'low', label: '低' },
  { value: 'normal', label: '中' },
  { value: 'high', label: '高' }
]

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <div className="text-[11px] font-medium text-muted-foreground">{label}</div>
      {children}
    </div>
  )
}

function Segmented({
  value,
  options,
  onChange
}: {
  value: Level
  options: { value: Level; label: string }[]
  onChange: (v: Level) => void
}) {
  return (
    <div className="flex items-center gap-0.5 rounded-md border border-border bg-secondary/40 p-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            'flex-1 rounded px-2 py-0.5 text-[12px] transition-colors',
            value === o.value
              ? 'bg-primary/20 font-medium text-primary'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function DetailPanel() {
  const todo = useTodos((s) => s.todos.find((t) => t.id === s.selectedId) ?? null)
  const select = useTodos((s) => s.select)
  const update = useTodos((s) => s.update)
  const addTag = useTodos((s) => s.addTag)
  const removeTag = useTodos((s) => s.removeTag)
  const addStep = useTodos((s) => s.addStep)
  const toggleStep = useTodos((s) => s.toggleStep)
  const deleteStep = useTodos((s) => s.deleteStep)
  const updateStep = useTodos((s) => s.updateStep)
  const archive = useTodos((s) => s.archive)
  const remove = useTodos((s) => s.remove)

  const [title, setTitle] = useState('')
  const [notes, setNotes] = useState('')
  const [due, setDue] = useState('')
  const [tagInput, setTagInput] = useState('')
  const [stepInput, setStepInput] = useState('')
  const [editingStep, setEditingStep] = useState<string | null>(null)
  const stepInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (todo) {
      setTitle(todo.title)
      setNotes(todo.notes)
      setDue(toLocalInput(todo.dueAt))
    }
  }, [todo?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!todo) return null

  const saveTitle = () => {
    const t = title.trim()
    if (t && t !== todo.title) void update({ id: todo.id, title: t })
    else setTitle(todo.title)
  }
  const saveNotes = () => {
    if (notes !== todo.notes) void update({ id: todo.id, notes })
  }
  const saveDue = (value: string) => {
    setDue(value)
    void update({ id: todo.id, dueAt: fromLocalInput(value) })
  }

  return (
    <TooltipProvider>
      <aside className="flex w-[360px] shrink-0 animate-slide-in-right flex-col border-l border-border bg-card/50">
        {/* 头部 */}
        <div className="flex items-center gap-1 border-b border-border px-2.5 py-1.5">
          <span className="text-[11px] text-muted-foreground">任务详情</span>
          <div className="flex-1" />
          <Button
            variant="ghost"
            size="icon-sm"
            title="归档"
            onClick={() => void archive(todo.id)}
          >
            <Archive className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            title="删除"
            className="hover:text-destructive"
            onClick={() => void remove(todo.id)}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="icon-sm" title="关闭 (Esc)" onClick={() => select(null)}>
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>

        <ScrollArea className="min-h-0 flex-1">
          <div className="space-y-4 p-3">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onBlur={saveTitle}
              onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
              className={cn(
                'w-full bg-transparent text-[15px] font-medium outline-none placeholder:text-muted-foreground',
                todo.status === 'completed' && 'text-muted-foreground line-through'
              )}
              placeholder="任务标题"
            />

            {/* 象限快捷设置 */}
            <Field label="四象限">
              <div className="grid grid-cols-2 gap-1">
                {QUADRANTS.map((q) => {
                  const meta = QUADRANT_META[q]
                  const active = levelsToQuadrant(todo.importance, todo.urgency) === q
                  return (
                    <button
                      key={q}
                      onClick={() =>
                        void update({
                          id: todo.id,
                          importance: q === 1 || q === 2 ? 'high' : 'normal',
                          urgency: q === 1 || q === 3 ? 'high' : 'normal'
                        })
                      }
                      className={cn(
                        'flex items-center gap-1.5 rounded-md border px-2 py-1 text-[12px] transition-colors',
                        active ? 'border-primary/60 bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:bg-accent'
                      )}
                    >
                      <span className="h-1.5 w-1.5 rounded-full" style={{ background: meta.cssVar }} />
                      {meta.title}
                    </button>
                  )
                })}
              </div>
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="重要度">
                <Segmented
                  value={todo.importance}
                  options={LEVELS}
                  onChange={(v) => void update({ id: todo.id, importance: v })}
                />
              </Field>
              <Field label="紧急度">
                <Segmented
                  value={todo.urgency}
                  options={LEVELS}
                  onChange={(v) => void update({ id: todo.id, urgency: v })}
                />
              </Field>
            </div>

            <Field label="截止时间">
              <div className="flex items-center gap-1">
                <div className="relative flex-1">
                  <CalendarDays className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                  <input
                    type="datetime-local"
                    value={due}
                    onChange={(e) => saveDue(e.target.value)}
                    className="h-8 w-full rounded-md border border-input bg-background/60 pl-7 pr-2 text-[12px] outline-none focus-visible:ring-1 focus-visible:ring-ring [color-scheme:dark]"
                  />
                </div>
                {due && (
                  <Button variant="ghost" size="icon-sm" title="清除截止时间" onClick={() => saveDue('')}>
                    <X className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            </Field>

            <Field label="标签">
              <div className="flex flex-wrap items-center gap-1">
                {todo.tags.map((t) => (
                  <Badge key={t} variant="secondary" className="gap-0.5 pr-0.5">
                    #{t}
                    <button
                      className="rounded-full p-0.5 hover:bg-destructive/20 hover:text-red-400"
                      onClick={() => void removeTag(todo.id, t)}
                    >
                      <X className="h-2.5 w-2.5" />
                    </button>
                  </Badge>
                ))}
                <div className="relative">
                  <Tag className="pointer-events-none absolute left-1.5 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && tagInput.trim()) {
                        void addTag(todo.id, tagInput)
                        setTagInput('')
                      }
                      if (e.key === 'Escape') setTagInput('')
                    }}
                    placeholder="添加标签"
                    className="h-6 w-24 pl-6 text-[11px]"
                  />
                </div>
              </div>
            </Field>

            <Separator />

            {/* 步骤 / 子任务 */}
            <Field label={`步骤 (${todo.steps.filter((s) => s.completed).length}/${todo.steps.length})`}>
              <div className="space-y-0.5">
                {todo.steps.map((step) => (
                  <div
                    key={step.id}
                    className="group flex items-center gap-2 rounded px-1 py-0.5 hover:bg-accent/60"
                  >
                    <Checkbox
                      checked={step.completed}
                      onCheckedChange={() => void toggleStep(step.id)}
                    />
                    {editingStep === step.id ? (
                      <input
                        autoFocus
                        defaultValue={step.title}
                        onBlur={(e) => {
                          const v = e.target.value.trim()
                          if (v) void updateStep(step.id, { title: v })
                          setEditingStep(null)
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
                          if (e.key === 'Escape') setEditingStep(null)
                        }}
                        className="flex-1 bg-transparent text-[12px] outline-none"
                      />
                    ) : (
                      <span
                        onDoubleClick={() => setEditingStep(step.id)}
                        className={cn(
                          'flex-1 cursor-text text-[12px]',
                          step.completed && 'text-muted-foreground line-through'
                        )}
                      >
                        {step.title}
                      </span>
                    )}
                    <button
                      className="rounded p-0.5 text-muted-foreground opacity-0 hover:text-destructive group-hover:opacity-100"
                      onClick={() => void deleteStep(step.id)}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
                <div className="flex items-center gap-2 pt-1">
                  <Plus className="h-3.5 w-3.5 text-muted-foreground" />
                  <input
                    ref={stepInputRef}
                    value={stepInput}
                    onChange={(e) => setStepInput(e.target.value)}
                    onKeyDown={async (e) => {
                      if (e.key === 'Enter' && stepInput.trim()) {
                        await addStep(todo.id, stepInput)
                        setStepInput('')
                        stepInputRef.current?.focus()
                      }
                    }}
                    placeholder="添加步骤，回车保存"
                    className="flex-1 bg-transparent text-[12px] outline-none placeholder:text-muted-foreground"
                  />
                </div>
              </div>
            </Field>

            <Field label="备注">
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                onBlur={saveNotes}
                placeholder="补充说明…"
                className="min-h-[80px] text-[12px]"
              />
            </Field>

            <div className="space-y-0.5 border-t border-border pt-2 text-[11px] text-muted-foreground">
              <div>创建于 {new Date(todo.createdAt).toLocaleString('zh-CN', { hour12: false })}</div>
              <div>更新于 {new Date(todo.updatedAt).toLocaleString('zh-CN', { hour12: false })}</div>
            </div>
          </div>
        </ScrollArea>
      </aside>
    </TooltipProvider>
  )
}
