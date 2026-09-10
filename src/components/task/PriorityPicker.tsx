import { useCallback, useEffect, useRef, useState } from 'react'
import { quadrantAt } from '@shared/board'
import { QUADRANT_META } from '@shared/quadrant'
import { cn } from '@/lib/utils'

export interface PriorityPickerProps {
  /** 归一化坐标：x 右=紧急，y 上=重要（与 shared/board.ts 一致） */
  value: { x: number; y: number } | null
  onChange: (p: { x: number; y: number }) => void
  /** 正方形边长（px） */
  size?: number
  className?: string
}

/** 四角色调：顺序对应下面 backgroundImage 的 左上 / 右上 / 左下 / 右下。
 *  坐标系为「右=紧急、上=重要」，所以依次是 Q2 / Q1 / Q4 / Q3。 */
const CORNER_TINT = [
  'hsl(var(--q2) / 0.16)',
  'hsl(var(--q1) / 0.16)',
  'hsl(var(--q4) / 0.14)',
  'hsl(var(--q3) / 0.16)'
]

/**
 * 2D 优先级选择器：一块连续的重要性 × 紧急性画布。
 * 上 = 重要，下 = 不重要；右 = 紧急，左 = 不紧急。
 * 拖一个点即可，不需要分别选象限 / 重要度 / 紧急度。
 */
export function PriorityPicker({ value, onChange, size = 148, className }: PriorityPickerProps) {
  const ref = useRef<HTMLDivElement>(null)
  const [dragging, setDragging] = useState(false)
  /**
   * 拖动 / 键盘微调期间的本地值。只有松手（或抬键、失焦）时才提交，
   * 否则每个 pointermove 都会写一次库并触发一次全量刷新。
   */
  const [pending, setPending] = useState<{ x: number; y: number } | null>(null)
  const pendingRef = useRef<{ x: number; y: number } | null>(null)

  // 未落点时用中心偏下（不太重要、不太紧急）作为起点提示
  const point = pending ?? value ?? { x: 0.5, y: 0.62 }
  const zone = QUADRANT_META[quadrantAt(point)]

  const stage = useCallback((p: { x: number; y: number } | null) => {
    pendingRef.current = p
    setPending(p)
  }, [])

  /** 提交本地值：一次交互只落一次库（拖动的 pointerup / 键盘 keyup / 失焦时触发） */
  const commit = useCallback(() => {
    const p = pendingRef.current
    if (!p) return
    stage(null)
    onChange(p)
  }, [onChange, stage])

  const pointFromEvent = useCallback((clientX: number, clientY: number) => {
    const el = ref.current
    if (!el) return null
    const rect = el.getBoundingClientRect()
    return {
      x: Math.min(1, Math.max(0, (clientX - rect.left) / rect.width)),
      y: Math.min(1, Math.max(0, (clientY - rect.top) / rect.height))
    }
  }, [])

  useEffect(() => {
    if (!dragging) return
    const move = (e: PointerEvent) => {
      const p = pointFromEvent(e.clientX, e.clientY)
      if (p) stage(p)
    }
    const up = () => {
      setDragging(false)
      commit()
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', up)
    return () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', up)
    }
  }, [dragging, pointFromEvent, stage, commit])

  const nudge = (dx: number, dy: number) => {
    stage({
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
          aria-label="优先级：上=重要，右=紧急"
          onPointerDown={(e) => {
            e.preventDefault()
            const p = pointFromEvent(e.clientX, e.clientY)
            if (!p) return
            setDragging(true)
            stage(p)
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
          onKeyUp={commit}
          onBlur={commit}
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
          <span>不紧急</span>
          <span className="text-muted-foreground/40">紧急</span>
        </div>
      </div>

      <div className="flex min-w-0 flex-1 flex-col justify-center gap-1 pl-0.5">
        <div className="flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full" style={{ background: zone.dotVar }} />
          <span className="text-[12px] font-medium leading-none">{zone.title}</span>
        </div>
        <span className="text-2xs leading-tight text-muted-foreground">{zone.action}</span>
        <span
          className="font-mono text-[10px] text-muted-foreground/60"
          title="重要度 · 紧急度"
        >
          {Math.round((1 - point.y) * 100)} · {Math.round(point.x * 100)}
        </span>
      </div>
    </div>
  )
}
