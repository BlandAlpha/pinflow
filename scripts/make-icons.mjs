/**
 * 生成应用图标（纯 Node 实现，无第三方依赖）
 *
 * 输出：
 *   resources/icon.png              256x256（窗口图标 / Linux）
 *   resources/icon.ico              多尺寸（Windows exe 与 NSIS 安装包）
 *   resources/icon.icns             macOS 应用图标（仅 macOS 上生成，系统 iconutil 转档）
 *   resources/tray.png              64x64 彩色托盘图（Windows / Linux）
 *   resources/trayTemplate.png/@2x  18/36 模板托盘图（macOS 菜单栏，纯黑 + alpha，由系统着色）
 */
import { spawnSync } from 'node:child_process'
import { deflateSync } from 'node:zlib'
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
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
function paint(size, { insetRatio = 0.03, radiusRatio = 0.24 } = {}) {
  const buf = Buffer.alloc(size * size * 4)
  const s = size
  const inset = s * insetRatio
  const boxSize = s - inset * 2
  const radius = s * radiusRatio
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

/**
 * 组装 .ico：包含 Windows 常用的全部尺寸，任务栏 / 资源管理器才能拿到清晰的图标。
 * 每个条目都是 PNG 压缩（Windows Vista+ 原生支持）。
 */
function makeIco(entries) {
  const header = Buffer.alloc(6)
  header.writeUInt16LE(0, 0)
  header.writeUInt16LE(1, 2)
  header.writeUInt16LE(entries.length, 4)

  const dirSize = 6 + entries.length * 16
  let offset = dirSize
  const dir = []
  for (const { size, png } of entries) {
    const e = Buffer.alloc(16)
    e[0] = size >= 256 ? 0 : size
    e[1] = size >= 256 ? 0 : size
    e[2] = 0
    e[3] = 0
    e.writeUInt16LE(1, 4)
    e.writeUInt16LE(32, 6)
    e.writeUInt32LE(png.length, 8)
    e.writeUInt32LE(offset, 12)
    offset += png.length
    dir.push(e)
  }
  return Buffer.concat([header, ...dir, ...entries.map((e) => e.png)])
}

mkdirSync(OUT_DIR, { recursive: true })

const ICO_SIZES = [16, 20, 24, 32, 40, 48, 64, 96, 128, 256]

const icon256 = encodePng(256, 256, paint(256))
const tray64 = encodePng(64, 64, paint(64))
const icoEntries = ICO_SIZES.map((size) => ({
  size,
  png: size === 256 ? icon256 : encodePng(size, size, paint(size))
}))

writeFileSync(join(OUT_DIR, 'icon.png'), icon256)
writeFileSync(join(OUT_DIR, 'icon.ico'), makeIco(icoEntries))
writeFileSync(join(OUT_DIR, 'tray.png'), tray64)

/* -------------------- macOS：菜单栏模板图 + .icns -------------------- */

/**
 * 菜单栏模板图：只取 alpha（RGB 必须是黑），macOS 会按菜单栏深浅色自己着色，
 * 所以不能像 tray.png 那样带靛蓝底色。文件名带 @2x 的会被系统在 Retina 屏自动取用。
 */
function paintTemplate(size) {
  const buf = Buffer.alloc(size * size * 4)
  const thick = size * 0.115
  const pts = [
    [0.14, 0.52],
    [0.40, 0.78],
    [0.87, 0.22]
  ].map(([x, y]) => [x * size, y * size])
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4
      const d1 = distToSegment(x + 0.5, y + 0.5, pts[0][0], pts[0][1], pts[1][0], pts[1][1])
      const d2 = distToSegment(x + 0.5, y + 0.5, pts[1][0], pts[1][1], pts[2][0], pts[2][1])
      const mark = Math.max(0, 1 - (Math.min(d1, d2) - thick / 2))
      buf[i + 3] = Math.round(255 * Math.min(1, mark))
    }
  }
  return buf
}

writeFileSync(join(OUT_DIR, 'trayTemplate.png'), encodePng(18, 18, paintTemplate(18)))
writeFileSync(join(OUT_DIR, 'trayTemplate@2x.png'), encodePng(36, 36, paintTemplate(36)))

/**
 * .icns 只能在 macOS 上生成（依赖系统自带的 iconutil）。
 * 与 Windows 图标不同，macOS 的 app 图标要按规范留出四周空白（内容约占 82%）。
 */
if (process.platform === 'darwin') {
  const MAC_ICON = { insetRatio: 0.085, radiusRatio: 0.225 }
  const ICNS_ENTRIES = [
    [16, 'icon_16x16.png'],
    [32, 'icon_16x16@2x.png'],
    [32, 'icon_32x32.png'],
    [64, 'icon_32x32@2x.png'],
    [128, 'icon_128x128.png'],
    [256, 'icon_128x128@2x.png'],
    [256, 'icon_256x256.png'],
    [512, 'icon_256x256@2x.png'],
    [512, 'icon_512x512.png'],
    [1024, 'icon_512x512@2x.png']
  ]
  const setDir = join(OUT_DIR, 'icon.iconset')
  rmSync(setDir, { recursive: true, force: true })
  mkdirSync(setDir, { recursive: true })
  for (const [size, name] of ICNS_ENTRIES) {
    writeFileSync(join(setDir, name), encodePng(size, size, paint(size, MAC_ICON)))
  }
  const r = spawnSync('iconutil', ['-c', 'icns', setDir, '-o', join(OUT_DIR, 'icon.icns')], {
    encoding: 'utf8'
  })
  rmSync(setDir, { recursive: true, force: true })
  if (r.status === 0) console.log('icon.icns written')
  else console.warn('[icons] iconutil 生成 .icns 失败:', r.stderr || r.error?.message)
} else {
  console.log('非 macOS：跳过 icon.icns（打包 macOS 版请在 mac 上执行本脚本）')
}

console.log('icons written to', OUT_DIR)
