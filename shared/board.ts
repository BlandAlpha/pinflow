import type { Level, Quadrant } from './types'

/**
 * 白板坐标系：一块连续的重要性 × 紧急性二维空间。
 *
 *   y = 0（上）  ── 重要          y = 1（下）  ── 不重要
 *   x = 0（左）  ── 紧急          x = 1（右）  ── 不紧急
 *
 * 它不是四个桶，而是一片连续空间；象限只是给位置起的方便名字。
 */

/** 白板逻辑像素尺寸（渲染时按此坐标铺开，窗口更小时可滚动） */
export const BOARD_W = 1240
export const BOARD_H = 800

/** 卡片尺寸（用于避让计算） */
export const CARD_W = 188
export const CARD_H = 74

export interface BoardPoint {
  x: number
  y: number
}

export function clamp01(v: number): number {
  if (Number.isNaN(v)) return 0
  return Math.min(1, Math.max(0, v))
}

export function clampPoint(p: BoardPoint): BoardPoint {
  return { x: clamp01(p.x), y: clamp01(p.y) }
}

/** 位置 -> 象限编号（仅用于命名与兼容，不改变连续语义） */
export function quadrantAt(p: BoardPoint): Quadrant {
  const important = p.y < 0.5
  const urgent = p.x < 0.5
  if (important && urgent) return 1
  if (important && !urgent) return 2
  if (!important && urgent) return 3
  return 4
}

/** 连续重要度（0..1，越大越重要） */
export function importanceAt(p: BoardPoint): number {
  return clamp01(1 - p.y)
}

/** 连续紧急度（0..1，越大越紧急） */
export function urgencyAt(p: BoardPoint): number {
  return clamp01(1 - p.x)
}

function toLevel(v: number): Level {
  if (v >= 0.66) return 'high'
  if (v >= 0.33) return 'normal'
  return 'low'
}

/** 位置 -> 内部重要度/紧急度（用于与旧逻辑兼容与排序兜底） */
export function levelsAt(p: BoardPoint): { importance: Level; urgency: Level } {
  return {
    importance: toLevel(importanceAt(p)),
    urgency: toLevel(urgencyAt(p))
  }
}

/** 象限中心点：用于把旧数据/快捷键映射到白板位置 */
export function positionForQuadrant(q: Quadrant): BoardPoint {
  switch (q) {
    case 1:
      return { x: 0.25, y: 0.25 }
    case 2:
      return { x: 0.75, y: 0.25 }
    case 3:
      return { x: 0.25, y: 0.75 }
    default:
      return { x: 0.75, y: 0.75 }
  }
}

/** 有坐标的任务位置；无坐标时返回 null（由视图负责自动排布） */
export function pointOf(todo: { boardX: number | null; boardY: number | null }): BoardPoint | null {
  if (todo.boardX == null || todo.boardY == null) return null
  return { x: todo.boardX, y: todo.boardY }
}

/** 稳定哈希：让同一批任务每次自动排布得到同样的位置 */
function hash01(seed: string, salt: number): number {
  let h = 2166136261 ^ salt
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return ((h >>> 0) % 10000) / 10000
}

/**
 * 给尚未放到白板上的任务找互不重叠的落点。
 * 从中心向外螺旋取样，跳过已被占用的格子 —— 保留「随手一放」的手感，
 * 又不会让新任务叠成一堆。
 */
export function packFreeSpots(occupied: BoardPoint[], count: number, anchor: BoardPoint = { x: 0.5, y: 0.5 }, seed = ''): BoardPoint[] {
  const stepX = (CARD_W + 26) / BOARD_W
  const stepY = (CARD_H + 22) / BOARD_H
  const cols = Math.max(1, Math.floor(1 / stepX))
  const rows = Math.max(1, Math.floor(1 / stepY))

  const taken = new Set<string>()
  const key = (c: number, r: number) => `${c}:${r}`
  for (const p of occupied) {
    taken.add(key(Math.round(p.x / stepX), Math.round(p.y / stepY)))
  }

  const spots: BoardPoint[] = []
  for (let i = 0; i < count; i++) {
    let best: { c: number; r: number; d: number } | null = null
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (taken.has(key(c, r))) continue
        const px = Math.min(1, (c + 0.5) * stepX)
        const py = Math.min(1, (r + 0.5) * stepY)
        const jitter = (hash01(seed + i, c * 31 + r) - 0.5) * 0.004
        const d = Math.hypot(px - anchor.x, py - anchor.y) + jitter
        if (!best || d < best.d) best = { c, r, d }
      }
    }
    if (!best) {
      const p = { x: anchor.x, y: anchor.y }
      spots.push(clampPoint(p))
      continue
    }
    taken.add(key(best.c, best.r))
    spots.push(
      clampPoint({
        x: Math.min(1, (best.c + 0.5) * stepX),
        y: Math.min(1, (best.r + 0.5) * stepY)
      })
    )
  }
  return spots
}

/** 落点与其它卡片重叠时做轻微避让（保留自由摆放感，只推开一点点） */
export function avoidOverlap(
  p: BoardPoint,
  others: BoardPoint[],
  selfIndex = -1
): BoardPoint {
  const minX = (CARD_W + 10) / BOARD_W
  const minY = (CARD_H + 8) / BOARD_H
  let cur = clampPoint(p)
  for (let i = 0; i < others.length; i++) {
    if (i === selfIndex) continue
    const o = others[i]
    let guard = 0
    while (Math.abs(o.x - cur.x) < minX && Math.abs(o.y - cur.y) < minY && guard < 8) {
      const candidateA = { x: cur.x + minX * 0.9, y: cur.y }
      const candidateB = { x: cur.x, y: cur.y + minY * 0.9 }
      const next =
        candidateA.x <= 0.97 && Math.abs(o.y - candidateA.y) >= minY
          ? candidateA
          : candidateB.y <= 0.97
            ? candidateB
            : { x: cur.x - minX * 0.9, y: cur.y - minY * 0.6 }
      cur = clampPoint(next)
      guard++
    }
  }
  return cur
}
