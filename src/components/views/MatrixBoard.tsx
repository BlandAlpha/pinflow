import { useMemo, useState } from 'react'
import { Inbox } from 'lucide-react'
import type { Quadrant, Todo } from '@shared/types'
import { QUADRANTS, QUADRANT_META, quadrantOf } from '@shared/quadrant'
import { useVisibleTodos } from '@/hooks/useVisibleTodos'
import { useTodos } from '@/store/todos'
import { cn } from '@/lib/utils'
import { TaskCard } from '@/components/task/TaskCard'
import { ScrollArea } from '@/components/ui/scroll-area'

type DropZone = { quadrant: Quadrant | 'unclassified'; beforeId?: string }

/**
 * 真正的 2×2 艾森豪威尔看板。
 * 拖拽是主要交互：卡片可跨象限移动，也可在同一象限内重排。
 * 未分类任务停在底部暂存区，拖入象限即完成分类。
 */
export function MatrixBoard() {
  const todos = useVisibleTodos()
  const setQuadrant = useTodos((s) => s.setQuadrant)
  const reorder = useTodos((s) => s.reorder)
  const update = useTodos((s) => s.update)
  const select = useTodos((s) => s.select)
  const selectedId = useTodos((s) => s.selectedId)

  const [dragId, setDragId] = useState<string | null>(null)
  const [zone, setZone] = useState<DropZone | null>(null)

  const { grouped, unclassified } = useMemo(() => {
    const g: Record<Quadrant, Todo[]> = { 1: [], 2: [], 3: [], 4: [] }
    const un: Todo[] = []
    for (const t of todos) {
      if (!t.classified) un.push(t)
      else g[quadrantOf(t)].push(t)
    }
    return { grouped: g, unclassified: un }
  }, [todos])

  const draggingTodo = dragId ? todos.find((t) => t.id === dragId) ?? null : null

  const handleDrop = async (target: DropZone) => {
    const id = dragId
    setDragId(null)
    setZone(null)
    if (!id) return

    if (target.quadrant === 'unclassified') {
      await update({ id, classified: false })
      return
    }

    const list = grouped[target.quadrant].filter((t) => t.id !== id)
    const moved = todos.find((t) => t.id === id)
    if (!moved) return

    const insertAt = target.beforeId ? list.findIndex((t) => t.id === target.beforeId) : -1
    const nextList = [...list]
    if (insertAt >= 0) nextList.splice(insertAt, 0, moved)
    else nextList.push(moved)

    if (!moved.classified || quadrantOf(moved) !== target.quadrant) {
      await setQuadrant(id, target.quadrant)
    }
    await reorder(nextList.map((t) => t.id))
  }

  const renderZone = (quadrant: Quadrant | 'unclassified', list: Todo[]) => {
    const isQ = quadrant !== 'unclassified'
    const meta = isQ ? QUADRANT_META[quadrant] : null
    const active = zone?.quadrant === quadrant
    return (
      <div
        onDragOver={(e) => {
          e.preventDefault()
          if (zone?.quadrant !== quadrant || zone.beforeId !== undefined) setZone({ quadrant })
        }}
        onDragLeave={(e) => {
          if (e.currentTarget.contains(e.relatedTarget as Node)) return
          setZone((z) => (z?.quadrant === quadrant ? null : z))
        }}
        onDrop={(e) => {
          e.preventDefault()
          void handleDrop({ quadrant })
        }}
        className={cn(
          'flex min-h-0 flex-col rounded-lg border transition-colors',
          isQ ? 'border-border' : 'border-dashed border-border',
          active && 'border-primary/60 bg-primary/5'
        )}
        style={isQ ? { background: meta?.tintVar } : undefined}
      >
        {/* 象限头 */}
        <div className="flex shrink-0 items-center gap-2 px-3 py-2">
          {meta && (
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: meta.dotVar }} />
          )}
          {!meta && <Inbox className="h-3.5 w-3.5 text-muted-foreground" />}
          <span className="text-[12px] font-medium">{meta ? meta.title : '未分类'}</span>
          <span className="text-2xs text-muted-foreground">
            {meta ? meta.action : '拖到上方象限完成分类'}
          </span>
          <span className="ml-auto rounded bg-background/60 px-1.5 font-mono text-2xs text-muted-foreground">
            {list.length}
          </span>
        </div>

        <ScrollArea className="min-h-0 flex-1">
          <div className="space-y-1.5 px-2 pb-2">
            {list.length === 0 && (
              <div className="px-1 py-4 text-center text-2xs text-muted-foreground/70">
                {isQ ? '拖动任务到这里' : '暂无未分类任务'}
              </div>
            )}
            {list.map((t) => (
              <div
                key={t.id}
                onDragOver={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  if (dragId && dragId !== t.id) setZone({ quadrant, beforeId: t.id })
                }}
                className="relative"
              >
                {zone?.quadrant === quadrant && zone.beforeId === t.id && (
                  <div className="absolute -top-1 left-0 right-0 h-0.5 rounded bg-primary" />
                )}
                <TaskCard
                  todo={t}
                  variant="board"
                  selected={selectedId === t.id}
                  draggable
                  dragging={dragId === t.id}
                  onDragStart={(e) => {
                    setDragId(t.id)
                    e.dataTransfer.effectAllowed = 'move'
                  }}
                  onDragEnd={() => {
                    setDragId(null)
                    setZone(null)
                  }}
                  onOpen={() => select(t.id)}
                />
              </div>
            ))}
          </div>
        </ScrollArea>
      </div>
    )
  }

  const showLane = unclassified.length > 0 || dragId !== null

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2 p-2">
      <div className="grid min-h-0 flex-1 grid-cols-2 grid-rows-2 gap-2">
        {QUADRANTS.map((q) => renderZone(q, grouped[q]))}
      </div>
      {showLane && (
        <div className="h-[132px] shrink-0">{renderZone('unclassified', unclassified)}</div>
      )}
      {dragId && draggingTodo && (
        <div className="pointer-events-none fixed bottom-2 right-3 rounded bg-popover px-2 py-1 text-2xs text-muted-foreground shadow-pop">
          正在移动「{draggingTodo.title}」
        </div>
      )}
    </div>
  )
}
