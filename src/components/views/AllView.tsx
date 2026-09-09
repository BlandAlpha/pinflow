import { Search, X } from 'lucide-react'
import type { TodoFilter } from '@shared/types'
import { useTodos } from '@/store/todos'
import { useVisibleTodos } from '@/hooks/useVisibleTodos'
import { TaskCard } from '@/components/task/TaskCard'
import { EmptyState } from '@/components/task/EmptyState'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { cn } from '@/lib/utils'

const STATUS_OPTIONS: { value: TodoFilter['status']; label: string }[] = [
  { value: 'active', label: '进行中' },
  { value: 'completed', label: '已完成' },
  { value: 'archived', label: '已归档' },
  { value: 'all', label: '全部状态' }
]

const DUE_OPTIONS: { value: TodoFilter['dueRange']; label: string }[] = [
  { value: 'all', label: '任何时间' },
  { value: 'overdue', label: '已逾期' },
  { value: 'today', label: '今天到期' },
  { value: 'week', label: '7 天内' },
  { value: 'none', label: '无截止' }
]

const SORT_OPTIONS: { value: TodoFilter['sort']; label: string }[] = [
  { value: 'priority', label: '优先级' },
  { value: 'due', label: '截止时间' },
  { value: 'created', label: '创建时间' },
  { value: 'updated', label: '更新时间' }
]

/** 全部任务：允许更密集、更工具化，是搜索/筛选/归档的唯一去处 */
export function AllView() {
  const filter = useTodos((s) => s.filter)
  const setFilter = useTodos((s) => s.setFilter)
  const tags = useTodos((s) => s.tags)
  const select = useTodos((s) => s.select)
  const selectedId = useTodos((s) => s.selectedId)
  const todos = useVisibleTodos()

  const dirty =
    !!filter.keyword || filter.status !== 'all' || !!filter.tag || filter.dueRange !== 'all'

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 flex-wrap items-center gap-1.5 border-b border-border px-3 py-2">
        <div className="relative w-64">
          <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={filter.keyword}
            onChange={(e) => setFilter({ keyword: e.target.value })}
            placeholder="搜索标题 / 备注 / 步骤 / 标签"
            className="h-7 pl-7 text-[12px]"
          />
        </div>

        <FilterSelect
          value={filter.status}
          options={STATUS_OPTIONS}
          onChange={(v) => setFilter({ status: v })}
        />
        <FilterSelect
          value={filter.dueRange}
          options={DUE_OPTIONS}
          onChange={(v) => setFilter({ dueRange: v })}
        />
        <FilterSelect
          value={filter.sort}
          options={SORT_OPTIONS}
          onChange={(v) => setFilter({ sort: v })}
          width="w-24"
        />

        {tags.length > 0 && (
          <div className="flex flex-wrap items-center gap-1">
            {tags.map((t) => (
              <button
                key={t}
                onClick={() => setFilter({ tag: filter.tag === t ? null : t })}
                className={cn(
                  'rounded border px-1.5 py-px text-2xs transition-colors',
                  filter.tag === t
                    ? 'border-primary/50 bg-primary/10 text-primary'
                    : 'border-border text-muted-foreground hover:bg-accent'
                )}
              >
                #{t}
              </button>
            ))}
          </div>
        )}

        <span className="ml-auto text-2xs text-muted-foreground">{todos.length} 条</span>
        {dirty && (
          <Button
            variant="ghost"
            size="xs"
            className="text-muted-foreground"
            onClick={() =>
              setFilter({ keyword: '', status: 'all', tag: null, dueRange: 'all', sort: 'priority' })
            }
          >
            <X className="h-3 w-3" />
            清除
          </Button>
        )}
      </div>

      {todos.length === 0 ? (
        <EmptyState title="没有匹配的任务" description="换个关键词或清除筛选试试" />
      ) : (
        <ScrollArea className="flex-1">
          <div className="space-y-px px-1.5 py-1.5">
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

function FilterSelect<T extends string>({
  value,
  options,
  onChange,
  width = 'w-24'
}: {
  value: T
  options: { value: T; label: string }[]
  onChange: (v: T) => void
  width?: string
}) {
  return (
    <Select value={value} onValueChange={(v) => onChange(v as T)}>
      <SelectTrigger className={cn('h-7', width)}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
