/**
 * 生成应用图标（纯 Node 实现，无第三方依赖）
 * 输出：resources/tray.png (64x64)、resources/icon.png (256x256)、resources/icon.ico (256x256)
 */
import { deflateSync } from 'node:zlib'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUT_DIR = join(__dirname, '..', 'resources')

/* ------------------------------ PNG 编码 ------------------------------ */

const CRC_TABLE = (() => {
  const table = new Int32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    table[n] = c
  }
  return table
})()

function crc32(buf) {
  let c = 0xffffffff
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii')
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length, 0)
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0)
  return Buffer.concat([len, typeBuf, data, crc])
}

function encodePng(width, height, rgba) {
  const raw = Buffer.alloc((width * 4 + 1) * height)
  for (let y = 0; y < height; y++) {
    raw[y * (width * 4 + 1)] = 0
    rgba.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4)
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 6 // color type RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0))
  ])
}

/* ------------------------------ 绘制 ------------------------------ */

function roundedRectAlpha(x, y, w, h, r) {
  const cx = Math.min(Math.max(x, r), w - r)
  const cy = Math.min(Math.max(y, r), h - r)
  const dx = x - cx
  const dy = y - cy
  const dist = Math.hypot(dx, dy)
  if (dist <= r) return 1
  return Math.max(0, 1 - (dist - r))
}

function distToSegment(px, py, ax, ay, bx, by) {
  const vx = bx - ax
  const vy = by - ay
  const wx = px - ax
  const wy = py - ay
  const len2 = vx * vx + vy * vy
  const t = len2 === 0 ? 0 : Math.min(1, Math.max(0, (wx * vx + wy * vy) / len2))
  return Math.hypot(px - (ax + vx * t), py - (ay + vy * t))
}

/** 生成图标像素：靛蓝圆角方块 + 白色对勾 */
function paint(size) {
  const buf = Buffer.alloc(size * size * 4)
  const s = size
  const inset = s * 0.03
  const boxSize = s - inset * 2
  const radius = s * 0.24
  const thick = s * 0.085

  const pts = [
    [0.28, 0.51],
    [0.43, 0.67],
    [0.73, 0.33]
  ].map(([px, py]) => [inset + px * boxSize, inset + py * boxSize])

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4
      const bg = roundedRectAlpha(x - inset, y - inset, boxSize, boxSize, radius)

      const d1 = distToSegment(x + 0.5, y + 0.5, pts[0][0], pts[0][1], pts[1][0], pts[1][1])
      const d2 = distToSegment(x + 0.5, y + 0.5, pts[1][0], pts[1][1], pts[2][0], pts[2][1])
      const mark = Math.max(0, 1 - (Math.min(d1, d2) - thick / 2))

      // 背景色：#6366f1 -> #4f46e5 纵向渐变
      const t = y / size
      const r = Math.round(99 + (79 - 99) * t)
      const g = Math.round(102 + (70 - 102) * t)
      const b = Math.round(241 + (229 - 241) * t)

      const a = Math.min(1, bg)
      const m = Math.min(1, mark) * a
      buf[i] = Math.round(r * (1 - m) + 255 * m)
      buf[i + 1] = Math.round(g * (1 - m) + 255 * m)
      buf[i + 2] = Math.round(b * (1 - m) + 255 * m)
      buf[i + 3] = Math.round(255 * a)
    }
  }
  return buf
}

function makeIco(pngBuf) {
  const header = Buffer.alloc(6)
  header.writeUInt16LE(0, 0)
  header.writeUInt16LE(1, 2)
  header.writeUInt16LE(1, 4)
  const entry = Buffer.alloc(16)
  entry[0] = 0 // 256
  entry[1] = 0 // 256
  entry[2] = 0
  entry[3] = 0
  entry.writeUInt16LE(1, 4)
  entry.writeUInt16LE(32, 6)
  entry.writeUInt32LE(pngBuf.length, 8)
  entry.writeUInt32LE(22, 12)
  return Buffer.concat([header, entry, pngBuf])
}

mkdirSync(OUT_DIR, { recursive: true })

const icon256 = encodePng(256, 256, paint(256))
const tray64 = encodePng(64, 64, paint(64))

writeFileSync(join(OUT_DIR, 'icon.png'), icon256)
writeFileSync(join(OUT_DIR, 'icon.ico'), makeIco(icon256))
writeFileSync(join(OUT_DIR, 'tray.png'), tray64)

console.log('icons written to', OUT_DIR)
