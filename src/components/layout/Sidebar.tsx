import { useEffect, useState } from 'react'
import { Database, Inbox, LayoutGrid, ListTree, Sun } from 'lucide-react'
import type { ViewKey } from '@shared/types'
import { useTodos } from '@/store/todos'
import { isInboxTask } from '@/lib/visible'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { ThemeToggle } from '@/components/theme/ThemeToggle'

const NAV: {
  key: ViewKey
  label: string
  icon: React.ComponentType<{ className?: string }>
  hint?: string
}[] = [
  { key: 'inbox', label: '收件箱', icon: Inbox, hint: '刚记下来、还没分类的事' },
  { key: 'today', label: '今天', icon: Sun, hint: '系统排好的行动顺序' },
  { key: 'matrix', label: '四象限', icon: LayoutGrid, hint: '拖一拖就能分类' },
  { key: 'all', label: '全部任务', icon: ListTree, hint: '搜索、筛选、归档' }
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
    matrix: todos.filter((t) => t.status === 'active' && t.classified).length,
    all: todos.length
  }

  return (
    <aside className="flex w-52 shrink-0 flex-col border-r border-border bg-surface-2/60">
      <nav className="flex-1 space-y-0.5 p-2">
        {NAV.map((item) => (
          <button
            key={item.key}
            title={item.hint}
            onClick={() => setView(item.key)}
            className={cn(
              'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13px] transition-colors',
              view === item.key
                ? 'bg-primary/10 font-medium text-primary'
                : 'text-foreground/85 hover:bg-accent'
            )}
          >
            <item.icon className="h-4 w-4" />
            <span className="flex-1">{item.label}</span>
            <span className="font-mono text-2xs text-muted-foreground">{counts[item.key]}</span>
          </button>
        ))}

        {tags.length > 0 && (
          <>
            <Separator className="my-2" />
            <div className="flex flex-wrap gap-1 px-2">
              {tags.map((tag) => (
                <button
                  key={tag}
                  onClick={() => {
                    setFilter({ tag: filter.tag === tag ? null : tag })
                    setView('all')
                  }}
                  className={cn(
                    'rounded border px-1.5 py-px text-2xs transition-colors',
                    filter.tag === tag
                      ? 'border-primary/50 bg-primary/10 text-primary'
                      : 'border-border text-muted-foreground hover:bg-accent'
                  )}
                >
                  #{tag}
                </button>
              ))}
            </div>
          </>
        )}
      </nav>

      <div className="space-y-0.5 border-t border-border p-2 text-2xs text-muted-foreground">
        <ThemeToggle />
        <label className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1 hover:bg-accent hover:text-foreground">
          <input
            type="checkbox"
            checked={autoStart}
            onChange={(e) => {
              setAutoStart(e.target.checked)
              void window.api.setAutoLaunch(e.target.checked)
            }}
            className="h-3 w-3 accent-[hsl(var(--primary))]"
          />
          开机自动启动
        </label>
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start gap-2 px-2 text-2xs font-normal text-muted-foreground"
          onClick={() => void window.api.openDbDir()}
        >
          <Database className="h-3.5 w-3.5" />
          数据库位置
        </Button>
        <div className="px-2 pb-1">Ctrl+Shift+Space 快速捕获</div>
      </div>
    </aside>
  )
}
