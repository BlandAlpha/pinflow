import { Moon, Sun } from 'lucide-react'
import type { ThemeMode } from '@shared/types'
import { useTheme } from '@/components/theme/ThemeProvider'
import { cn } from '@/lib/utils'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

/** 跟随系统：太阳 + 月牙的组合图标（不用显示器图标） */
export function SunMoonIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <circle cx="12" cy="12" r="4" />
      <path d="M12 3v1.6M12 19.4V21M3 12h1.6M19.4 12H21M5.6 5.6l1.1 1.1M17.3 17.3l1.1 1.1M18.4 5.6l-1.1 1.1M6.7 17.3l-1.1 1.1" />
      <path d="M15.6 3.2a8.2 8.2 0 1 0 5.2 5.2 6.4 6.4 0 0 1-5.2-5.2Z" />
    </svg>
  )
}

const OPTIONS: { value: ThemeMode; label: string; Icon: React.ComponentType<{ className?: string }> }[] =
  [
    { value: 'light', label: '浅色', Icon: Sun },
    { value: 'dark', label: '深色', Icon: Moon },
    { value: 'system', label: '跟随系统', Icon: SunMoonIcon }
  ]

/**
 * 主题切换：只用图标表达模式，标签仅出现在提示里。
 * 浅色 / 深色 / 跟随系统 —— 跟随系统用日+月的组合图标。
 */
export function ThemeSwitcher({
  stacked = false,
  className
}: {
  /** 侧栏底部等横向空间紧张时改为一列 */
  stacked?: boolean
  className?: string
}) {
  const { mode, setMode } = useTheme()

  return (
    <div
      className={cn(
        'inline-flex items-center gap-0.5 rounded-md border border-border bg-background p-0.5',
        stacked && 'flex-col',
        className
      )}
      role="group"
      aria-label="主题"
    >
      {OPTIONS.map(({ value, label, Icon }) => {
        const active = mode === value
        return (
          <Tooltip key={value}>
            <TooltipTrigger asChild>
              <button
                onClick={() => setMode(value)}
                aria-label={label}
                aria-pressed={active}
                className={cn(
                  'flex h-6 w-7 items-center justify-center rounded transition-colors',
                  active
                    ? 'bg-primary/12 text-primary'
                    : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                )}
              >
                <Icon className="h-3.5 w-3.5" />
              </button>
            </TooltipTrigger>
            <TooltipContent side={stacked ? 'right' : 'top'}>{label}</TooltipContent>
          </Tooltip>
        )
      })}
    </div>
  )
}
