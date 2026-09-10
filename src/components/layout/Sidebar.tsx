import { useEffect, useMemo, useState } from 'react'
import { Inbox, LayoutGrid, ListTree, Settings, Sun } from 'lucide-react'
import type { ViewKey } from '@shared/types'
import { useTodos } from '@/store/todos'
import { isInboxTask } from '@/lib/visible'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { ThemeSwitcher } from '@/components/theme/ThemeSwitcher'
import { SettingsDialog } from '@/components/layout/SettingsDialog'
import { SpaceSwitcher } from '@/components/layout/SpaceSwitcher'

type SidebarMode = 'full' | 'compact' | 'icon'

const NAV: {
  key: ViewKey
  label: string
  icon: React.ComponentType<{ className?: string }>
  hint: string
}[] = [
  { key: 'inbox', label: '收件箱', icon: Inbox, hint: '刚记下来、还没归类的事' },
  { key: 'today', label: '今天', icon: Sun, hint: '排好的行动顺序' },
  { key: 'board', label: '白板', icon: LayoutGrid, hint: '把任务拖到合适的位置' },
  { key: 'all', label: '全部任务', icon: ListTree, hint: '搜索、筛选、归档' }
]

/** 侧栏宽度自适应：宽窗完整、中等窗紧凑、窄窗图标抽屉（悬停展开） */
function useSidebarMode(): SidebarMode {
  const [mode, setMode] = useState<SidebarMode>(() => modeFor(window.innerWidth))
  useEffect(() => {
    const onResize = () => setMode(modeFor(window.innerWidth))
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])
  return mode
}

function modeFor(width: number): SidebarMode {
  if (width >= 1240) return 'full'
  if (width >= 1040) return 'compact'
  return 'icon'
}

const RAIL: Record<SidebarMode, number> = { full: 216, compact: 68, icon: 48 }

export function Sidebar() {
  const mode = useSidebarMode()
  const [hover, setHover] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const view = useTodos((s) => s.view)
  const setView = useTodos((s) => s.setView)
  const todos = useTodos((s) => s.todos)
  const activeSpaceId = useTodos((s) => s.activeSpaceId)
  const tags = useTodos((s) => s.tags)
  const filter = useTodos((s) => s.filter)
  const setFilter = useTodos((s) => s.setFilter)

  const expanded = mode !== 'full' && hover
  const showLabels = mode === 'full' || expanded

  // 计数只统计当前空间：空间是硬边界
  const scoped = useMemo(
    () => (activeSpaceId ? todos.filter((t) => t.spaceId === activeSpaceId) : todos),
    [todos, activeSpaceId]
  )

  const counts: Record<ViewKey, number> = {
    inbox: scoped.filter((t) => t.status === 'active' && isInboxTask(t)).length,
    today: scoped.filter((t) => t.status === 'active').length,
    board: scoped.filter((t) => t.status === 'active').length,
    all: scoped.length
  }

  const nav = (
    <nav className="flex-1 space-y-0.5 overflow-y-auto p-2">
      {NAV.map((item) => {
        const active = view === item.key
        const button = (
          <button
            key={item.key}
            onClick={() => setView(item.key)}
            className={cn(
              'flex h-8 w-full items-center rounded-md text-left transition-colors',
              showLabels ? 'gap-2 px-2 text-[13px]' : 'justify-center px-0',
              active
                ? 'bg-primary/10 font-medium text-primary'
                : 'text-foreground/80 hover:bg-accent hover:text-foreground'
            )}
          >
            <item.icon className="h-4 w-4 shrink-0" />
            {showLabels && (
              <>
                <span className="flex-1 truncate">{item.label}</span>
                <span className="font-mono text-2xs text-muted-foreground">{counts[item.key]}</span>
              </>
            )}
          </button>
        )
        if (showLabels) return button
        return (
          <Tooltip key={item.key}>
            <TooltipTrigger asChild>{button}</TooltipTrigger>
            <TooltipContent side="right">
              {item.label} · {counts[item.key]}
            </TooltipContent>
          </Tooltip>
        )
      })}

      {showLabels && tags.length > 0 && (
        <div className="flex flex-wrap gap-1 px-2 pt-3">
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
      )}
    </nav>
  )

  const footer = (
    <div
      className={cn(
        'flex shrink-0 flex-col gap-2 border-t border-border p-2',
        showLabels ? 'items-stretch' : 'items-center'
      )}
    >
      <ThemeSwitcher showLabel={showLabels} />
      {showLabels ? (
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start gap-2 px-2 text-[12px] font-normal text-muted-foreground"
          onClick={() => setSettingsOpen(true)}
        >
          <Settings className="h-3.5 w-3.5" />
          设置
        </Button>
      ) : (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              className="text-muted-foreground"
              onClick={() => setSettingsOpen(true)}
              aria-label="设置"
            >
              <Settings className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="right">设置</TooltipContent>
        </Tooltip>
      )}
    </div>
  )

  const spaceBar = (
    <div className="shrink-0 border-t border-border p-2">
      <SpaceSwitcher showLabel={showLabels} onManage={() => setSettingsOpen(true)} />
    </div>
  )

  return (
    <div className="relative shrink-0" style={{ width: RAIL[mode] }}>
      <aside
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        className={cn(
          'absolute inset-y-0 left-0 z-40 flex flex-col overflow-hidden border-r border-border bg-surface-2/80 backdrop-blur-md transition-[width,box-shadow] duration-150 ease-out',
          expanded && 'shadow-pop'
        )}
        style={{ width: showLabels ? RAIL.full : RAIL[mode] }}
      >
        {nav}
        {spaceBar}
        {footer}
      </aside>
      <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
    </div>
  )
}
