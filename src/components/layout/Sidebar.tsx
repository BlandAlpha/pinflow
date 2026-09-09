import { useEffect, useState } from 'react'
import { Database, Inbox, LayoutGrid, ListTree, Sun } from 'lucide-react'
import type { ViewKey } from '@shared/types'
import { useTodos } from '@/store/todos'
import { isInboxTask } from '@/lib/visible'
import { cn } from '@/lib/utils'
import { Checkbox } from '@/components/ui/checkbox'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'

const NAV: { key: ViewKey; label: string; icon: React.ComponentType<{ className?: string }>; hint?: string }[] = [
  { key: 'inbox', label: '收件箱', icon: Inbox, hint: '未分类的新任务' },
  { key: 'today', label: '今天', icon: Sun, hint: '按优先级排序' },
  { key: 'matrix', label: '四象限', icon: LayoutGrid, hint: '艾森豪威尔矩阵' },
  { key: 'all', label: '全部任务', icon: ListTree, hint: '搜索与筛选' }
]

export function Sidebar() {
  const view = useTodos((s) => s.view)
  const setView = useTodos((s) => s.setView)
  const todos = useTodos((s) => s.todos)
  const tags = useTodos((s) => s.tags)
  const filter = useTodos((s) => s.filter)
  const setFilter = useTodos((s) => s.setFilter)
  const [autoStart, setAutoStart] = useState(false)

  useEffect(() => {
    void window.api.getAutoLaunch().then(setAutoStart)
  }, [])

  const counts: Record<ViewKey, number> = {
    inbox: todos.filter((t) => t.status === 'active' && isInboxTask(t)).length,
    today: todos.filter((t) => t.status === 'active').length,
    matrix: todos.filter((t) => t.status === 'active').length,
    all: todos.length
  }

  return (
    <aside className="flex w-48 shrink-0 flex-col border-r border-border bg-card/40">
      <nav className="flex-1 space-y-0.5 p-2">
        {NAV.map((item) => (
          <button
            key={item.key}
            title={item.hint}
            onClick={() => setView(item.key)}
            className={cn(
              'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13px] transition-colors',
              view === item.key
                ? 'bg-primary/15 font-medium text-primary'
                : 'text-foreground/85 hover:bg-accent'
            )}
          >
            <item.icon className="h-4 w-4" />
            <span className="flex-1">{item.label}</span>
            <span
              className={cn(
                'rounded px-1 font-mono text-[11px]',
                view === item.key ? 'bg-primary/20' : 'bg-secondary'
              )}
            >
              {counts[item.key]}
            </span>
          </button>
        ))}

        {tags.length > 0 && (
          <>
            <Separator className="my-2" />
            <div className="px-2 pb-1 text-[11px] font-medium text-muted-foreground">标签</div>
            <div className="flex flex-wrap gap-1 px-2 pb-1">
              {tags.map((tag) => (
                <button
                  key={tag}
                  onClick={() => {
                    setFilter({ tag: filter.tag === tag ? null : tag })
                    setView('all')
                  }}
                  className={cn(
                    'rounded border border-border px-1.5 py-0.5 text-[11px] transition-colors hover:bg-accent',
                    filter.tag === tag ? 'bg-primary/15 text-primary' : 'text-muted-foreground'
                  )}
                >
                  #{tag}
                </button>
              ))}
            </div>
          </>
        )}
      </nav>

      <div className="space-y-1.5 border-t border-border p-2 text-[11px] text-muted-foreground">
        <label className="flex cursor-pointer items-center gap-2 px-1 py-0.5 hover:text-foreground">
          <Checkbox
            checked={autoStart}
            onCheckedChange={(v) => {
              const enabled = v === true
              setAutoStart(enabled)
              void window.api.setAutoLaunch(enabled)
            }}
          />
          开机自动启动
        </label>
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start px-1 text-[11px] text-muted-foreground"
          onClick={() => void window.api.openDbDir()}
        >
          <Database className="h-3.5 w-3.5" />
          数据库位置
        </Button>
        <div className="px-1">Ctrl+Shift+Space 快速捕获</div>
      </div>
    </aside>
  )
}
