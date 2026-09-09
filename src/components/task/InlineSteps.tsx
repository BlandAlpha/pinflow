import { useRef, useState } from 'react'
import { Check, Plus, X } from 'lucide-react'
import type { Todo } from '@shared/types'
import { useTodos } from '@/store/todos'
import { cn } from '@/lib/utils'

/** 卡片内展开的轻量步骤列表：一次点击 + 输入即可添加 */
export function InlineSteps({ todo, dense = false }: { todo: Todo; dense?: boolean }) {
  const addStep = useTodos((s) => s.addStep)
  const toggleStep = useTodos((s) => s.toggleStep)
  const deleteStep = useTodos((s) => s.deleteStep)
  const [value, setValue] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const submit = async () => {
    const title = value.trim()
    if (!title) return
    setValue('')
    await addStep(todo.id, title)
    inputRef.current?.focus()
  }

  return (
    <div className={cn('space-y-1', dense ? 'pt-1' : 'pt-1.5')}>
      {todo.steps.map((step) => (
        <div key={step.id} className="group/step flex items-center gap-2">
          <button
            onClick={() => void toggleStep(step.id)}
            className={cn(
              'flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded border transition-colors',
              step.completed
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-border-strong hover:border-primary'
            )}
            title={step.completed ? '标记未完成' : '标记完成'}
          >
            {step.completed && <Check className="h-2.5 w-2.5" strokeWidth={3} />}
          </button>
          <span
            className={cn(
              'flex-1 truncate text-[12px]',
              step.completed && 'text-muted-foreground line-through'
            )}
          >
            {step.title}
          </span>
          <button
            onClick={() => void deleteStep(step.id)}
            className="rounded p-0.5 text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover/step:opacity-100"
            title="删除步骤"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      ))}

      <div className="flex items-center gap-2">
        <Plus className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        <input
          ref={inputRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.stopPropagation()
              void submit()
            }
            if (e.key === 'Escape') {
              e.stopPropagation()
              setValue('')
            }
          }}
          placeholder="添加步骤，回车保存"
          className="flex-1 bg-transparent text-[12px] outline-none placeholder:text-muted-foreground"
        />
      </div>
    </div>
  )
}
