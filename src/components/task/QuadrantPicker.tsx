import { QUADRANTS, QUADRANT_META } from '@shared/quadrant'
import type { Quadrant } from '@shared/types'
import { cn } from '@/lib/utils'
import {
  Popover,
  PopoverContent,
  PopoverTrigger
} from '@/components/ui/popover'

/**
 * 象限选择器：面向用户的唯一分类入口。
 * 以 2×2 紧凑面板呈现，选中后立即持久化（无确认弹窗）。
 */
export function QuadrantPicker({
  value,
  onChange,
  children,
  align = 'start'
}: {
  value: Quadrant | null
  onChange: (q: Quadrant) => void
  children?: React.ReactNode
  align?: 'start' | 'center' | 'end'
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent align={align} className="w-[268px] p-1.5">
        <div className="px-1 pb-1 text-2xs text-muted-foreground">分类</div>
        <div className="grid grid-cols-2 gap-1">
          {QUADRANTS.map((q) => {
            const meta = QUADRANT_META[q]
            const active = value === q
            return (
              <button
                key={q}
                onClick={() => onChange(q)}
                className={cn(
                  'group flex flex-col items-start gap-0.5 rounded-md border px-2 py-1.5 text-left transition-colors',
                  active
                    ? 'border-primary/60 bg-primary/10'
                    : 'border-border hover:bg-accent'
                )}
              >
                <span className="flex items-center gap-1.5">
                  <span
                    className="h-1.5 w-1.5 rounded-full"
                    style={{ background: meta.dotVar }}
                  />
                  <span className="text-[12px] font-medium">{meta.title}</span>
                </span>
                <span className="pl-3 text-2xs text-muted-foreground">{meta.action}</span>
              </button>
            )
          })}
        </div>
      </PopoverContent>
    </Popover>
  )
}

/** 只读象限徽标（卡片上的小圆点 + 可选文字） */
export function QuadrantDot({
  quadrant,
  className,
  title
}: {
  quadrant: Quadrant
  className?: string
  title?: string
}) {
  const meta = QUADRANT_META[quadrant]
  return (
    <span
      className={cn('h-1.5 w-1.5 shrink-0 rounded-full', className)}
      style={{ background: meta.dotVar }}
      title={title ?? meta.title}
    />
  )
}
