import { Search, X } from 'lucide-react'
import type { TodoFilter } from '@shared/types'
import { useTodos } from '@/store/todos'
import { useVisibleTodos } from '@/hooks/useVisibleTodos'
import { ListView } from '@/components/views/ListView'
import { QuickAdd } from '@/components/task/QuickAdd'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const STATUS_OPTIONS: { value: TodoFilter['status']; label: string }[] = [
  { value: 'all', label: '全部' },
  { value: 'active', label: '进行中' },
  { value: 'completed', label: '已完成' },
  { value: 'archived', label: '已归档' }
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
  { value: 'created', label: '创建时间' },
  { value: 'updated', label: '更新时间' },
  { value: 'due', label: '截止时间' }
]

function ChipGroup<T extends string>({
  value,
  options,
  onChange
}: {
  value: T
  options: { value: T; label: string }[]
  onChange: (v: T) => void
}) {
  return (
    <div className="flex items-center gap-0.5 rounded-md border border-border bg-secondary/40 p-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            'rounded px-1.5 py-0.5 text-[11px] transition-colors',
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

export function AllView() {
  const filter = useTodos((s) => s.filter)
  const setFilter = useTodos((s) => s.setFilter)
  const tags = useTodos((s) => s.tags)
  const todos = useVisibleTodos()
  const hasFilter =
    !!filter.keyword || filter.status !== 'all' || !!filter.tag || filter.dueRange !== 'all'

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="shrink-0 space-y-2 border-b border-border p-2">
        <QuickAdd />
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={filter.keyword}
              onChange={(e) => setFilter({ keyword: e.target.value })}
              placeholder="搜索标题 / 备注 / 步骤 / 标签"
              className="h-7 w-56 pl-7 text-[12px]"
            />
          </div>
          <ChipGroup value={filter.status} options={STATUS_OPTIONS} onChange={(v) => setFilter({ status: v })} />
          <ChipGroup value={filter.dueRange} options={DUE_OPTIONS} onChange={(v) => setFilter({ dueRange: v })} />
          <ChipGroup value={filter.sort} options={SORT_OPTIONS} onChange={(v) => setFilter({ sort: v })} />
          {tags.length > 0 && (
            <div className="flex flex-wrap items-center gap-1">
              {tags.map((t) => (
                <button
                  key={t}
                  onClick={() => setFilter({ tag: filter.tag === t ? null : t })}
                  className={cn(
                    'rounded border px-1.5 py-0.5 text-[11px] transition-colors',
                    filter.tag === t
                      ? 'border-primary/60 bg-primary/15 text-primary'
                      : 'border-border text-muted-foreground hover:bg-accent'
                  )}
                >
                  #{t}
                </button>
              ))}
            </div>
          )}
          <span className="ml-auto text-[11px] text-muted-foreground">{todos.length} 条</span>
          {hasFilter && (
            <Button
              variant="ghost"
              size="xs"
              className="text-muted-foreground"
              onClick={() =>
                setFilter({ keyword: '', status: 'all', tag: null, dueRange: 'all', sort: 'priority' })
              }
            >
              <X className="h-3 w-3" />
              清除筛选
            </Button>
          )}
        </div>
      </div>
      <ListView />
    </div>
  )
}
