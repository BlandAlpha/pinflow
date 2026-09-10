import { Check, ChevronsUpDown, Settings2 } from 'lucide-react'
import { useTodos } from '@/store/todos'
import { cn } from '@/lib/utils'
import { SpaceGlyph } from '@/lib/space'
import * as DropdownMenu from '@/components/ui/dropdown-menu'

/**
 * 空间快速切换：放在侧栏底栏。
 * 空间是硬边界 —— 切过去之后，所有视图都只显示这个空间里的任务。
 */
export function SpaceSwitcher({
  showLabel = false,
  onManage,
  onOpenChange
}: {
  showLabel?: boolean
  onManage?: () => void
  /** 菜单开关上报：图标侧栏在弹层打开期间保持展开 */
  onOpenChange?: (open: boolean) => void
}) {
  const spaces = useTodos((s) => s.spaces)
  const activeSpaceId = useTodos((s) => s.activeSpaceId)
  const setActiveSpace = useTodos((s) => s.setActiveSpace)
  const todos = useTodos((s) => s.todos)

  const current = spaces.find((s) => s.id === activeSpaceId) ?? spaces[0]
  if (!current) return null

  const countOf = (id: string) =>
    todos.filter((t) => t.spaceId === id && t.status === 'active').length

  const trigger = (
    <button
      aria-label={`空间：${current.name}`}
      className={cn(
        'flex h-8 items-center rounded-md text-[13px] text-foreground transition-colors hover:bg-accent',
        showLabel ? 'w-full justify-start gap-2 px-2' : 'w-8 justify-center'
      )}
    >
      <SpaceGlyph icon={current.icon} color={current.color} className="h-4 w-4 shrink-0" />
      {showLabel && (
        <>
          <span className="flex-1 truncate text-left font-medium">{current.name}</span>
          <span className="font-mono text-2xs text-muted-foreground">{countOf(current.id)}</span>
          <ChevronsUpDown className="h-3 w-3 shrink-0 text-muted-foreground" />
        </>
      )}
    </button>
  )

  return (
    <DropdownMenu.DropdownMenu onOpenChange={onOpenChange}>
      <DropdownMenu.DropdownMenuTrigger asChild>{trigger}</DropdownMenu.DropdownMenuTrigger>
      <DropdownMenu.DropdownMenuContent
        align={showLabel ? 'start' : 'end'}
        side="top"
        className="w-52 p-1"
      >
        <div className="px-2 py-1 text-2xs text-muted-foreground">切换空间</div>
        {spaces.map((s) => {
          const active = s.id === current.id
          return (
            <DropdownMenu.DropdownMenuItem
              key={s.id}
              onSelect={() => void setActiveSpace(s.id)}
              className={cn('flex items-center gap-2 px-2 py-1.5 text-[13px]', active && 'text-foreground')}
            >
              <SpaceGlyph icon={s.icon} color={s.color} className="h-3.5 w-3.5 shrink-0" />
              <span className="flex-1 truncate">{s.name}</span>
              <span className="font-mono text-2xs text-muted-foreground">{countOf(s.id)}</span>
              {active && <Check className="h-3.5 w-3.5 shrink-0 text-primary" />}
            </DropdownMenu.DropdownMenuItem>
          )
        })}
        <DropdownMenu.DropdownMenuSeparator />
        <DropdownMenu.DropdownMenuItem
          onSelect={() => onManage?.()}
          className="flex items-center gap-2 px-2 py-1.5 text-[13px]"
        >
          <Settings2 className="h-3.5 w-3.5 text-muted-foreground" />
          管理空间…
        </DropdownMenu.DropdownMenuItem>
      </DropdownMenu.DropdownMenuContent>
    </DropdownMenu.DropdownMenu>
  )
}
