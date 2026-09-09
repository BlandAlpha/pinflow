import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { CalendarDays, Check, ListChecks, Sparkles } from 'lucide-react'
import type { Todo } from '@shared/types'
import {
  BOARD_H,
  BOARD_W,
  CARD_H,
  CARD_W,
  avoidOverlap,
  clampPoint,
  packFreeSpots,
  pointOf,
  quadrantAt
} from '@shared/board'
import { QUADRANT_META } from '@shared/quadrant'
import { useTodos } from '@/store/todos'
import { useVisibleTodos } from '@/hooks/useVisibleTodos'
import { cn } from '@/lib/utils'
import { dueTone, formatDue } from '@/lib/date'
import { Button } from '@/components/ui/button'

interface Placed {
  todo: Todo
  x: number
  y: number
  /** 尚未落点（只是系统自动排布） */
  auto: boolean
}

const CORNER_LABELS: { className: string; text: string }[] = [
  { className: 'left-3 top-2', text: '紧急 · 重要' },
  { className: 'right-3 top-2 text-right', text: '重要 · 不紧急' },
  { className: 'left-3 bottom-2', text: '紧急 · 不重要' },
  { className: 'right-3 bottom-2 text-right', text: '不紧急 · 不重要' }
]

/**
 * 白板：一块连续的「重要性 × 紧急性」二维空间。
 * 上=重要，下=不重要，左=紧急，右=不紧急。
 * 任务是空间里可以自由摆放的便签，位置本身就是分类。
 */
export function Whiteboard() {
  const todos = useVisibleTodos()
  const select = useTodos((s) => s.select)
  const selectedId = useTodos((s) => s.selectedId)
  const toggle = useTodos((s) => s.toggle)
  const setPosition = useTodos((s) => s.setPosition)

  const wrapRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ w: BOARD_W, h: BOARD_H })
  const [draft, setDraft] = useState<{ id: string; x: number; y: number } | null>(null)
  const dragRef = useRef<{ id: string; startX: number; startY: number; ox: number; oy: number; moved: boolean } | null>(
    null
  )

  useLayoutEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const measure = () => {
      setSize({
        w: Math.max(BOARD_W, el.clientWidth - 8),
        h: Math.max(BOARD_H, el.clientHeight - 8)
      })
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  /** 已落点的任务用真实坐标；未落点的由系统自动找空位（可拖拽覆盖） */
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
    const all = [
      ...fixed,
      ...loose.map((t, i) => ({ todo: t, x: spots[i].x, y: spots[i].y, auto: true }))
    ]
    // 展示时做一次稳定的轻量避让：同一点上的卡片会被稍稍推开，存储坐标不变
    const taken: { x: number; y: number }[] = []
    return all.map((p) => {
      const next = avoidOverlap({ x: p.x, y: p.y }, taken)
      taken.push(next)
      return { ...p, x: next.x, y: next.y }
    })
  }, [todos])

  const commit = useCallback(
    async (id: string, raw: { x: number; y: number }) => {
      const others = placed.filter((p) => p.todo.id !== id).map((p) => ({ x: p.x, y: p.y }))
      const next = avoidOverlap(clampPoint(raw), others)
      setDraft(null)
      await setPosition(id, next.x, next.y)
    },
    [placed, setPosition]
  )

  useEffect(() => {
    if (!draft) return
    const move = (e: PointerEvent) => {
      const drag = dragRef.current
      const canvas = canvasRef.current
      if (!drag || !canvas) return
      const dx = e.clientX - drag.startX
      const dy = e.clientY - drag.startY
      if (!drag.moved && Math.hypot(dx, dy) < 3) return
      drag.moved = true
      setDraft({
        id: drag.id,
        x: drag.ox + dx / canvas.clientWidth,
        y: drag.oy + dy / canvas.clientHeight
      })
    }
    const up = () => {
      const drag = dragRef.current
      dragRef.current = null
      if (drag?.moved && draft) void commit(drag.id, { x: draft.x, y: draft.y })
      else setDraft(null)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    return () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
    }
  }, [draft, commit])

  const tidy = async () => {
    // 只整理尚未落点的任务：让它们均匀铺开，已摆好的不动
    const loose = placed.filter((p) => p.auto)
    if (loose.length === 0) return
    const fixed = placed.filter((p) => !p.auto).map((p) => ({ x: p.x, y: p.y }))
    const spots = packFreeSpots(fixed, loose.length, { x: 0.5, y: 0.52 }, loose.map((p) => p.todo.id).join('|'))
    for (let i = 0; i < loose.length; i++) {
      // 顺序执行，避免并发写同一连接
      // eslint-disable-next-line no-await-in-loop
      await setPosition(loose[i].todo.id, spots[i].x, spots[i].y)
    }
  }

  const unplacedCount = placed.filter((p) => p.auto).length

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex h-10 shrink-0 items-center gap-2 border-b border-border px-3">
        <h1 className="text-[15px] font-semibold tracking-tight">白板</h1>
        <span className="text-2xs text-muted-foreground">
          上=重要 · 左=紧急，把任务拖到合适的位置
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
      </div>

      <div ref={wrapRef} className="min-h-0 flex-1 overflow-auto bg-background">
        <div
          ref={canvasRef}
          className="relative"
          style={{ width: size.w, height: size.h }}
        >
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
          <span className="pointer-events-none absolute left-1/2 top-1.5 -translate-x-1/2 select-none text-2xs tracking-wide text-muted-foreground/30">
            更重要 ↑
          </span>
          <span className="pointer-events-none absolute bottom-1.5 left-1/2 -translate-x-1/2 select-none text-2xs tracking-wide text-muted-foreground/30">
            较不重要 ↓
          </span>

          {placed.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center">
              <p className="text-[13px] text-muted-foreground">
                还没有任务。按 Ctrl+Shift+Space 记下一件事。
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
                onPointerDown={(e) => {
                  if ((e.target as HTMLElement).closest('[data-no-drag]')) return
                  const canvas = canvasRef.current
                  if (!canvas) return
                  ;(e.target as HTMLElement).setPointerCapture?.(e.pointerId)
                  dragRef.current = {
                    id: t.id,
                    startX: e.clientX,
                    startY: e.clientY,
                    ox: live.x,
                    oy: live.y,
                    moved: false
                  }
                }}
                onClick={() => {
                  if (dragRef.current?.moved) return
                  select(t.id)
                }}
                className={cn(
                  'group absolute flex cursor-grab touch-none flex-col gap-1 rounded-lg border bg-card px-2 py-1.5 text-card-foreground shadow-card transition-shadow',
                  'hover:border-border-strong',
                  p.auto && 'border-dashed',
                  selected ? 'border-primary/70 ring-1 ring-primary/30' : 'border-border',
                  dragging && 'z-30 cursor-grabbing shadow-raised',
                  completed && 'opacity-55'
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
