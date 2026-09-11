import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { CalendarDays, Check, ListChecks, Maximize2, Minus, Plus, Sparkles } from 'lucide-react'
import type { Todo } from '@shared/types'
import {
  BOARD_H,
  BOARD_W,
  CARD_H,
  CARD_W,
  clamp01,
  packFreeSpots,
  pointOf,
  quadrantAt
} from '@shared/board'
import { QUADRANT_META } from '@shared/quadrant'
import { useTodos } from '@/store/todos'
import { useVisibleTodos } from '@/hooks/useVisibleTodos'
import { cn } from '@/lib/utils'
import { CAPTURE_SHORTCUT_LABEL } from '@/lib/shortcut'
import { dueTone, formatDue } from '@/lib/date'
import { Button } from '@/components/ui/button'

interface Placed {
  todo: Todo
  x: number
  y: number
  /** 尚未落点（只是系统自动排布） */
  auto: boolean
}

interface Viewport {
  zoom: number
  x: number
  y: number
}

interface BoardSize {
  /** 画布逻辑尺寸 */
  w: number
  h: number
  /** 可视区域尺寸 */
  vw: number
  vh: number
}

const MAX_ZOOM = 3

const CORNER_LABELS: { className: string; text: string }[] = [
  { className: 'left-3 top-2', text: '重要 · 不紧急' },
  { className: 'right-3 top-2 text-right', text: '紧急 · 重要' },
  { className: 'left-3 bottom-2', text: '不紧急 · 不重要' },
  { className: 'right-3 bottom-2 text-right', text: '紧急 · 不重要' }
]

function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v))
}

/**
 * 让整块画布刚好铺满可视区的倍率（<= 1）。
 * 画布固定 1240×800，窄窗口下必须能缩到 fit，否则右半边永远看不到。
 */
function fitZoom(size: BoardSize): number {
  return Math.min(size.vw / size.w, size.vh / size.h)
}

/** 把视口夹在合法范围内：画布永远铺满可视区，拖不出边界 */
function clampViewport(v: Viewport, size: BoardSize): Viewport {
  const zoom = clamp(v.zoom, fitZoom(size), MAX_ZOOM)
  const minX = Math.min(0, size.vw - size.w * zoom)
  const minY = Math.min(0, size.vh - size.h * zoom)
  return {
    zoom,
    x: clamp(v.x, minX, 0),
    y: clamp(v.y, minY, 0)
  }
}

/**
 * 白板：一块连续的「重要性 × 紧急性」二维空间。
 * 上=重要，下=不重要，左=不紧急，右=紧急。
 * 卡片可以直接拖 —— 拖到哪儿就是哪儿，坐标即数据；缩放以光标为锚点，带补间。
 */
export function Whiteboard() {
  const todos = useVisibleTodos()
  const select = useTodos((s) => s.select)
  const selectedId = useTodos((s) => s.selectedId)
  const toggle = useTodos((s) => s.toggle)
  const setPositionLazy = useTodos((s) => s.setPositionLazy)
  const setPositions = useTodos((s) => s.setPositions)

  const wrapRef = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState<BoardSize>({ w: BOARD_W, h: BOARD_H, vw: BOARD_W, vh: BOARD_H })
  const sizeRef = useRef(size)
  sizeRef.current = size

  const [vp, setVp] = useState<Viewport>({ zoom: 1, x: 0, y: 0 })
  const vpRef = useRef(vp)
  vpRef.current = vp
  const targetRef = useRef(vp)
  const rafRef = useRef<number | null>(null)

  const [draft, setDraft] = useState<{ id: string; x: number; y: number } | null>(null)
  const [panning, setPanning] = useState(false)

  const stopAnim = useCallback(() => {
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
  }, [])

  /** 立即生效（拖动画布用） */
  const applyNow = useCallback(
    (next: Viewport) => {
      stopAnim()
      const c = clampViewport(next, sizeRef.current)
      vpRef.current = c
      targetRef.current = c
      setVp(c)
    },
    [stopAnim]
  )

  /** 补间到目标视口（缩放用）：指数趋近，约 190ms 走完 96% */
  const applySmooth = useCallback(
    (next: Viewport) => {
      targetRef.current = clampViewport(next, sizeRef.current)
      if (rafRef.current != null) return
      let last = performance.now()
      const tick = (now: number) => {
        const dt = Math.min(64, now - last)
        last = now
        const cur = vpRef.current
        const tgt = targetRef.current
        const k = 1 - Math.pow(0.04, dt / 190)
        const nextVp: Viewport = {
          zoom: cur.zoom + (tgt.zoom - cur.zoom) * k,
          x: cur.x + (tgt.x - cur.x) * k,
          y: cur.y + (tgt.y - cur.y) * k
        }
        const settled =
          Math.abs(tgt.zoom - nextVp.zoom) < 0.0006 &&
          Math.abs(tgt.x - nextVp.x) < 0.35 &&
          Math.abs(tgt.y - nextVp.y) < 0.35
        if (settled) {
          vpRef.current = tgt
          setVp(tgt)
          rafRef.current = null
          return
        }
        vpRef.current = nextVp
        setVp(nextVp)
        rafRef.current = requestAnimationFrame(tick)
      }
      rafRef.current = requestAnimationFrame(tick)
    },
    []
  )

  useEffect(() => stopAnim, [stopAnim])

  /* ------------------------------ 尺寸 ------------------------------ */
  useLayoutEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const measure = () => {
      const vw = el.clientWidth
      const vh = el.clientHeight
      setSize({ w: Math.max(BOARD_W, vw), h: Math.max(BOARD_H, vh), vw, vh })
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // 窗口变化后重新夹紧视口
  useEffect(() => {
    applyNow(vpRef.current)
  }, [size, applyNow])

  /* ------------------------------ 缩放 ------------------------------ */
  /** 以某个屏幕点为锚缩放到目标倍率 */
  const zoomAt = useCallback(
    (nextZoom: number, mx: number, my: number) => {
      const base = targetRef.current
      const zoom = clamp(nextZoom, fitZoom(sizeRef.current), MAX_ZOOM)
      const ratio = zoom / base.zoom
      applySmooth({
        zoom,
        x: mx - (mx - base.x) * ratio,
        y: my - (my - base.y) * ratio
      })
    },
    [applySmooth]
  )

  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const rect = el.getBoundingClientRect()
      const mx = e.clientX - rect.left
      const my = e.clientY - rect.top
      if (e.shiftKey && !e.ctrlKey) {
        const base = targetRef.current
        applySmooth({ ...base, x: base.x - e.deltaY })
        return
      }
      // 连续滚轮也平滑：每像素位移对应固定的比例变化
      zoomAt(targetRef.current.zoom * Math.exp(-e.deltaY * 0.0015), mx, my)
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [zoomAt, applySmooth])

  const zoomByStep = (factor: number) => {
    const { vw, vh } = sizeRef.current
    zoomAt(targetRef.current.zoom * factor, vw / 2, vh / 2)
  }

  const resetView = () => applySmooth({ zoom: 1, x: 0, y: 0 })

  /* ------------------------------ 平移 ------------------------------ */
  const startPan = (e: React.PointerEvent) => {
    if (e.button !== 0 && e.button !== 1) return
    if ((e.target as HTMLElement).closest('[data-board-card],[data-no-drag]')) return
    const startX = e.clientX
    const startY = e.clientY
    const base = { ...vpRef.current }
    let moved = false
    setPanning(true)

    const move = (ev: PointerEvent) => {
      const dx = ev.clientX - startX
      const dy = ev.clientY - startY
      if (!moved && Math.hypot(dx, dy) < 4) return
      moved = true
      applyNow({ zoom: base.zoom, x: base.x + dx, y: base.y + dy })
    }
    const up = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', up)
      setPanning(false)
      if (!moved) select(null)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', up)
  }

  /* ------------------------------ 卡片拖拽 ------------------------------ */
  const startDrag = (e: React.PointerEvent, p: Placed) => {
    if (e.button !== 0) return
    if ((e.target as HTMLElement).closest('[data-no-drag]')) return
    e.stopPropagation()
    const startX = e.clientX
    const startY = e.clientY
    const ox = p.x
    const oy = p.y
    let moved = false
    let latest = { x: ox, y: oy }

    const move = (ev: PointerEvent) => {
      const dx = ev.clientX - startX
      const dy = ev.clientY - startY
      if (!moved && Math.hypot(dx, dy) < 3) return
      moved = true
      const s = sizeRef.current
      const z = vpRef.current.zoom
      latest = { x: ox + dx / (s.w * z), y: oy + dy / (s.h * z) }
      setDraft({ id: p.todo.id, x: clamp01(latest.x), y: clamp01(latest.y) })
    }
    const up = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', up)
      // 放下时本地立即停靠（不闪烁），1 秒后才写库，减少读写压力
      if (moved) setPositionLazy(p.todo.id, clamp01(latest.x), clamp01(latest.y))
      else select(p.todo.id)
      setDraft(null)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', up)
  }

  /* ------------------------------ 落点 ------------------------------ */
  /** 已落点的任务用真实坐标；未落点的由系统自动找空位（拖一下即成为真实坐标） */
  const placed = useMemo<Placed[]>(() => {
    const fixed: Placed[] = []
    const loose: Todo[] = []
    for (const t of todos) {
      const p = pointOf(t)
      if (p) fixed.push({ todo: t, x: p.x, y: p.y, auto: false })
      else loose.push(t)
    }
    const spots = packFreeSpots(
      fixed.map((f) => ({ x: f.x, y: f.y })),
      loose.length,
      { x: 0.5, y: 0.52 },
      loose.map((t) => t.id).join('|')
    )
    return [
      ...fixed,
      ...loose.map((t, i) => ({ todo: t, x: spots[i].x, y: spots[i].y, auto: true }))
    ]
  }, [todos])

  const tidy = async () => {
    const loose = placed.filter((p) => p.auto)
    if (loose.length === 0) return
    const fixed = placed.filter((p) => !p.auto).map((p) => ({ x: p.x, y: p.y }))
    const spots = packFreeSpots(
      fixed,
      loose.length,
      { x: 0.5, y: 0.52 },
      loose.map((p) => p.todo.id).join('|')
    )
    // 一次 IPC、一个事务：N 张卡片不再是 N 次往返
    await setPositions(loose.map((p, i) => ({ id: p.todo.id, x: spots[i].x, y: spots[i].y })))
  }

  const unplacedCount = placed.filter((p) => p.auto).length
  const percent = Math.round(vp.zoom * 100)

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex h-10 shrink-0 items-center gap-2 border-b border-border px-3">
        <h1 className="text-[15px] font-semibold tracking-tight">白板</h1>
        <span className="hidden text-2xs text-muted-foreground xl:inline">
          拖动卡片摆放 · 滚轮缩放 · 拖空白平移
        </span>
        <div className="flex-1" />
        <span className="text-2xs text-muted-foreground">{todos.length} 项</span>
        <Button
          variant="ghost"
          size="xs"
          className="text-muted-foreground"
          disabled={unplacedCount === 0}
          onClick={() => void tidy()}
          title="把还没摆好的任务均匀铺开"
        >
          <Sparkles className="h-3 w-3" />
          整理{unplacedCount > 0 ? ` (${unplacedCount})` : ''}
        </Button>
        <div className="flex items-center gap-0.5 rounded-md border border-border px-0.5">
          <Button
            variant="ghost"
            size="icon-sm"
            className="h-6 w-6 text-muted-foreground"
            disabled={vp.zoom <= fitZoom(size) + 0.001}
            onClick={() => zoomByStep(1 / 1.25)}
            title="缩小"
          >
            <Minus className="h-3 w-3" />
          </Button>
          <button
            data-zoom-label
            onClick={resetView}
            className="min-w-[38px] px-0.5 text-center font-mono text-2xs text-muted-foreground transition-colors hover:text-foreground"
            title="恢复 100%"
          >
            {percent}%
          </button>
          <Button
            variant="ghost"
            size="icon-sm"
            className="h-6 w-6 text-muted-foreground"
            disabled={vp.zoom >= MAX_ZOOM - 0.001}
            onClick={() => zoomByStep(1.25)}
            title="放大"
          >
            <Plus className="h-3 w-3" />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            className="h-6 w-6 text-muted-foreground"
            onClick={resetView}
            title="回到原点"
          >
            <Maximize2 className="h-3 w-3" />
          </Button>
        </div>
      </div>

      <div
        ref={wrapRef}
        data-board-viewport
        onPointerDown={startPan}
        className={cn(
          'relative min-h-0 flex-1 touch-none overflow-hidden bg-background',
          panning ? 'cursor-grabbing' : 'cursor-grab'
        )}
      >
        <div
          data-board-stage
          className="absolute left-0 top-0 origin-top-left"
          style={{
            width: size.w,
            height: size.h,
            transform: `translate3d(${vp.x}px, ${vp.y}px, 0) scale(${vp.zoom})`
          }}
        >
          {/* 四角象限色：与 2D 选择器同款配色，更浅（0.10 / 0.08），
              只作方位暗示，不干扰卡片 */}
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              backgroundImage: [
                'radial-gradient(46% 46% at 0% 0%, hsl(var(--q2) / 0.10) 0%, transparent 70%)',
                'radial-gradient(46% 46% at 100% 0%, hsl(var(--q1) / 0.10) 0%, transparent 70%)',
                'radial-gradient(46% 46% at 0% 100%, hsl(var(--q4) / 0.08) 0%, transparent 70%)',
                'radial-gradient(46% 46% at 100% 100%, hsl(var(--q3) / 0.08) 0%, transparent 70%)'
              ].join(', ')
            }}
          />
          {/* 网格 */}
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              backgroundImage:
                'linear-gradient(to right, hsl(var(--border) / 0.55) 1px, transparent 1px), linear-gradient(to bottom, hsl(var(--border) / 0.55) 1px, transparent 1px)',
              backgroundSize: '41px 41px'
            }}
          />
          {/* 中轴 */}
          <div className="pointer-events-none absolute inset-x-0 top-1/2 h-px bg-border-strong/60" />
          <div className="pointer-events-none absolute inset-y-0 left-1/2 w-px bg-border-strong/60" />

          {/* 四角语义标签 */}
          {CORNER_LABELS.map((c) => (
            <span
              key={c.text}
              className={cn(
                'pointer-events-none absolute select-none text-2xs font-medium tracking-wide text-muted-foreground/35',
                c.className
              )}
            >
              {c.text}
            </span>
          ))}
          {/* 轴标签：留在屏幕边缘，紧贴各自轴线（竖轴右侧 / 横轴上方） */}
          <span className="pointer-events-none absolute left-1/2 top-1 ml-1.5 select-none text-2xs tracking-wide text-muted-foreground/30">
            重要
          </span>
          <span className="pointer-events-none absolute bottom-1 left-1/2 ml-1.5 select-none text-2xs tracking-wide text-muted-foreground/30">
            不重要
          </span>
          <span className="pointer-events-none absolute right-2 top-[calc(50%-2px)] -translate-y-full select-none text-2xs tracking-wide text-muted-foreground/30">
            紧急
          </span>
          <span className="pointer-events-none absolute left-2 top-[calc(50%-2px)] -translate-y-full select-none text-2xs tracking-wide text-muted-foreground/30">
            不紧急
          </span>

          {placed.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center">
              <p className="text-[13px] text-muted-foreground">
                还没有任务。按 {CAPTURE_SHORTCUT_LABEL} 记下一件事。
              </p>
            </div>
          )}

          {placed.map((p) => {
            const t = p.todo
            const live = draft?.id === t.id ? draft : p
            const meta = QUADRANT_META[quadrantAt(live)]
            const selected = selectedId === t.id
            const dragging = draft?.id === t.id
            const done = t.steps.filter((s) => s.completed).length
            const tone = dueTone(t)
            const completed = t.status === 'completed'
            return (
              <div
                key={t.id}
                data-board-card={t.id}
                onPointerDown={(e) => startDrag(e, p)}
                className={cn(
                  'group absolute flex cursor-grab touch-none flex-col gap-1 rounded-lg border bg-card px-2 py-1.5 text-card-foreground shadow-card transition-shadow',
                  'hover:border-border-strong',
                  p.auto && 'border-dashed',
                  selected ? 'border-primary/70 ring-1 ring-primary/30' : 'border-border',
                  dragging && 'z-30 cursor-grabbing shadow-raised'
                )}
                style={{
                  width: CARD_W,
                  minHeight: CARD_H,
                  left: live.x * size.w,
                  top: live.y * size.h,
                  transform: 'translate(-50%, -50%)',
                  zIndex: selected ? 20 : 1
                }}
              >
                <div className="flex items-start gap-1.5">
                  <button
                    data-no-drag
                    onClick={(e) => {
                      e.stopPropagation()
                      void toggle(t.id)
                    }}
                    title={completed ? '标记未完成' : '标记完成'}
                    className={cn(
                      'mt-px flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded border transition-colors',
                      completed
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'border-border-strong hover:border-primary'
                    )}
                  >
                    {completed && <Check className="h-2.5 w-2.5" strokeWidth={3} />}
                  </button>
                  <span
                    className={cn(
                      'line-clamp-2 min-w-0 flex-1 text-[12.5px] font-medium leading-[17px]',
                      completed && 'text-muted-foreground line-through'
                    )}
                  >
                    {t.title}
                  </span>
                </div>

                <div className="mt-auto flex items-center gap-1.5 text-2xs text-muted-foreground">
                  <span
                    className="h-1.5 w-1.5 shrink-0 rounded-full"
                    style={{ background: meta.dotVar }}
                    title={meta.title}
                  />
                  {t.dueAt && (
                    <span
                      className={cn(
                        'flex items-center gap-0.5',
                        tone === 'overdue' && 'text-destructive',
                        tone === 'soon' && 'text-warn'
                      )}
                    >
                      <CalendarDays className="h-3 w-3" />
                      {formatDue(t.dueAt)}
                    </span>
                  )}
                  {t.steps.length > 0 && (
                    <span className="flex items-center gap-0.5">
                      <ListChecks className="h-3 w-3" />
                      {done}/{t.steps.length}
                    </span>
                  )}
                  {p.auto && <span className="ml-auto text-muted-foreground/60">待归类</span>}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
