import { Monitor, Moon, Sun } from 'lucide-react'
import type { ThemeMode } from '@shared/types'
import { useTheme } from '@/components/theme/ThemeProvider'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'

const OPTIONS: { value: ThemeMode; label: string; icon: React.ComponentType<{ className?: string }> }[] =
  [
    { value: 'light', label: '浅色', icon: Sun },
    { value: 'dark', label: '深色', icon: Moon },
    { value: 'system', label: '跟随系统', icon: Monitor }
  ]

export function ThemeToggle({ className }: { className?: string }) {
  const { mode, setMode } = useTheme()
  const current = OPTIONS.find((o) => o.value === mode) ?? OPTIONS[2]
  const Icon = current.icon

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className={cn('w-full justify-start gap-2 px-2 text-[12px] font-normal', className)}
          title={`主题：${current.label}`}
        >
          <Icon className="h-3.5 w-3.5" />
          主题 · {current.label}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-36">
        <DropdownMenuLabel>外观</DropdownMenuLabel>
        {OPTIONS.map((o) => (
          <DropdownMenuItem
            key={o.value}
            onSelect={() => setMode(o.value)}
            className={cn(mode === o.value && 'bg-accent')}
          >
            <o.icon className="h-3.5 w-3.5" />
            {o.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
