import { useCallback, useEffect, useRef, useState } from 'react'
import { quadrantAt } from '@shared/board'
import { QUADRANT_META } from '@shared/quadrant'
import { cn } from '@/lib/utils'

export interface PriorityPickerProps {
  /** 归一化坐标：x 左=紧急，y 上=重要 */
  value: { x: number; y: number } | null
  onChange: (p: { x: number; y: number }) => void
  /** 正方形边长（px） */
  size?: number
  className?: string
}

const CORNER_TINT = [
  'hsl(var(--q1) / 0.16)',
  'hsl(var(--q2) / 0.16)',
  'hsl(var(--q3) / 0.16)',
  'hsl(var(--q4) / 0.14)'
]

/**
 * 2D 优先级选择器：一块连续的重要性 × 紧急性画布。
 * 上 = 重要，下 = 不重要；左 = 紧急，右 = 不紧急。
 * 拖一个点即可，不需要分别选象限 / 重要度 / 紧急度。
 */
export function PriorityPicker({ value, onChange, size = 148, className }: PriorityPickerProps) {
  const ref = useRef<HTMLDivElement>(null)
  const [dragging, setDragging] = useState(false)
  // 未落点时用中心偏下（不太重要、不太紧急）作为起点提示
  const point = value ?? { x: 0.5, y: 0.62 }
  const zone = QUADRANT_META[quadrantAt(point)]

  const emitFromEvent = useCallback(
    (clientX: number, clientY: number) => {
      const el = ref.current
      if (!el) return
      const rect = el.getBoundingClientRect()
      const x = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width))
      const y = Math.min(1, Math.max(0, (clientY - rect.top) / rect.height))
      onChange({ x, y })
    },
    [onChange]
  )

  useEffect(() => {
    if (!dragging) return
    const move = (e: PointerEvent) => emitFromEvent(e.clientX, e.clientY)
    const up = () => setDragging(false)
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    return () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
    }
  }, [dragging, emitFromEvent])

  const nudge = (dx: number, dy: number) => {
    onChange({
      x: Math.min(1, Math.max(0, point.x + dx)),
      y: Math.min(1, Math.max(0, point.y + dy))
    })
  }

  return (
    <div className={cn('flex items-stretch gap-2', className)}>
      {/* 竖轴：重要 */}
      <div
        className="flex shrink-0 flex-col items-center justify-between py-0.5 text-[10px] leading-none text-muted-foreground/70"
        style={{ height: size }}
      >
        <span>重要</span>
        <span className="text-muted-foreground/40">不重要</span>
      </div>

      <div className="flex flex-col gap-1">
        <div
          ref={ref}
          role="application"
          tabIndex={0}
          aria-label="优先级：上下为重要程度，左右为紧急程度"
          onPointerDown={(e) => {
            e.preventDefault()
            setDragging(true)
            emitFromEvent(e.clientX, e.clientY)
          }}
          onKeyDown={(e) => {
            const step = e.shiftKey ? 0.1 : 0.04
            if (e.key === 'ArrowLeft') nudge(-step, 0)
            else if (e.key === 'ArrowRight') nudge(step, 0)
            else if (e.key === 'ArrowUp') nudge(0, -step)
            else if (e.key === 'ArrowDown') nudge(0, step)
            else return
            e.preventDefault()
          }}
          className={cn(
            'relative cursor-crosshair touch-none rounded-md border border-border bg-muted/40 outline-none transition-shadow',
            'focus-visible:ring-2 focus-visible:ring-ring/60'
          )}
          style={{
            width: size,
            height: size,
            backgroundImage: [
              `radial-gradient(120% 120% at 0% 0%, ${CORNER_TINT[0]} 0%, transparent 62%)`,
              `radial-gradient(120% 120% at 100% 0%, ${CORNER_TINT[1]} 0%, transparent 62%)`,
              `radial-gradient(120% 120% at 0% 100%, ${CORNER_TINT[2]} 0%, transparent 62%)`,
              `radial-gradient(120% 120% at 100% 100%, ${CORNER_TINT[3]} 0%, transparent 62%)`
            ].join(', ')
          }}
        >
          {/* 中轴参考线 */}
          <div className="pointer-events-none absolute inset-x-0 top-1/2 h-px bg-border/70" />
          <div className="pointer-events-none absolute inset-y-0 left-1/2 w-px bg-border/70" />

          {/* 当前位置到边缘的引导线 */}
          <div
            className="pointer-events-none absolute left-0 h-px bg-primary/30"
            style={{ top: `${point.y * 100}%`, width: `${point.x * 100}%` }}
          />
          <div
            className="pointer-events-none absolute top-0 w-px bg-primary/30"
            style={{ left: `${point.x * 100}%`, height: `${point.y * 100}%` }}
          />

          {/* 手柄 */}
          <div
            className={cn(
              'pointer-events-none absolute h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-primary bg-background transition-transform',
              dragging && 'scale-125'
            )}
            style={{ left: `${point.x * 100}%`, top: `${point.y * 100}%` }}
          />

          {value == null && (
            <div className="pointer-events-none absolute inset-x-2 bottom-1.5 text-center text-[10px] text-muted-foreground/60">
              拖一下，放到合适的位置
            </div>
          )}
        </div>

        {/* 横轴：紧急 */}
        <div
          className="flex items-center justify-between px-0.5 text-[10px] leading-none text-muted-foreground/70"
          style={{ width: size }}
        >
          <span>紧急</span>
          <span className="text-muted-foreground/40">不紧急</span>
        </div>
      </div>

      <div className="flex min-w-0 flex-1 flex-col justify-center gap-1 pl-0.5">
        <div className="flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full" style={{ background: zone.dotVar }} />
          <span className="text-[12px] font-medium leading-none">{zone.title}</span>
        </div>
        <span className="text-2xs leading-tight text-muted-foreground">{zone.action}</span>
        <span className="font-mono text-[10px] text-muted-foreground/60">
          {Math.round((1 - point.y) * 100)} · {Math.round((1 - point.x) * 100)}
        </span>
      </div>
    </div>
  )
}
