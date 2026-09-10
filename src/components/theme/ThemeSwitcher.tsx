import { Moon, Sun, SunMoon, Check } from 'lucide-react'
import * as DropdownMenu from '@/components/ui/dropdown-menu'
import type { ThemeMode } from '@shared/types'
import { useTheme } from '@/components/theme/ThemeProvider'
import { cn } from '@/lib/utils'

/**
 * 主题切换：单个图标表示「当前是什么」，点击后弹出选择。
 * 仅 浅色 / 深色 / 跟随系统 —— 跟随系统用 lucide 的 SunMoon 组合图标，不用显示器图标。
 */
const OPTIONS: { value: ThemeMode; label: string; Icon: React.ComponentType<{ className?: string }> }[] =
  [
    { value: 'light', label: '浅色', Icon: Sun },
    { value: 'dark', label: '深色', Icon: Moon },
    { value: 'system', label: '跟随系统', Icon: SunMoon }
  ]

export function ThemeSwitcher({ className }: { className?: string }) {
  const { mode, setMode } = useTheme()
  const current = OPTIONS.find((o) => o.value === mode) ?? OPTIONS[2]
  const CurrentIcon = current.Icon

  const trigger = (
    <button
      aria-label={`主题：${current.label}`}
      className={cn(
        'flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground',
        className
      )}
    >
      <CurrentIcon className="h-4 w-4" />
    </button>
  )

  return (
    <DropdownMenu.DropdownMenu>
      <DropdownMenu.DropdownMenuTrigger asChild>{trigger}</DropdownMenu.DropdownMenuTrigger>
      <DropdownMenu.DropdownMenuContent
        align="end"
        side="top"
        className="w-36 p-1"
      >
        {OPTIONS.map(({ value, label, Icon }) => {
          const active = mode === value
          return (
            <DropdownMenu.DropdownMenuItem
              key={value}
              onSelect={() => setMode(value)}
              className={cn('flex items-center gap-2 px-2 py-1.5 text-[13px]', active && 'text-foreground')}
            >
              <Icon className="h-4 w-4 text-muted-foreground" />
              <span className="flex-1">{label}</span>
              {active && <Check className="h-3.5 w-3.5 text-primary" />}
            </DropdownMenu.DropdownMenuItem>
          )
        })}
      </DropdownMenu.DropdownMenuContent>
    </DropdownMenu.DropdownMenu>
  )
}
