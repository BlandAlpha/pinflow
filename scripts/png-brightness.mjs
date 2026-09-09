// 极简 PNG 解码：仅用于读取截图的平均亮度，判断浅色/深色主题。
// 用法: node scripts/png-brightness.mjs <file.png> [...]
import { readFileSync } from 'node:fs'
import { inflateSync } from 'node:zlib'

function decode(buf) {
  let pos = 8
  let width = 0
  let height = 0
  let bitDepth = 8
  let colorType = 6
  const idat = []
  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos)
    const type = buf.toString('ascii', pos + 4, pos + 8)
    const data = buf.subarray(pos + 8, pos + 8 + len)
    if (type === 'IHDR') {
      width = data.readUInt32BE(0)
      height = data.readUInt32BE(4)
      bitDepth = data[8]
      colorType = data[9]
    } else if (type === 'IDAT') {
      idat.push(data)
    } else if (type === 'IEND') break
    pos += 12 + len
  }
  if (bitDepth !== 8) throw new Error(`unsupported bitDepth ${bitDepth}`)
  const channels = { 0: 1, 2: 3, 4: 2, 6: 4 }[colorType]
  if (!channels) throw new Error(`unsupported colorType ${colorType}`)
  const raw = inflateSync(Buffer.concat(idat))
  const stride = width * channels
  const out = Buffer.alloc(height * stride)
  let rp = 0
  for (let y = 0; y < height; y++) {
    const filter = raw[rp++]
    const line = raw.subarray(rp, rp + stride)
    rp += stride
    const cur = out.subarray(y * stride, (y + 1) * stride)
    const prev = y > 0 ? out.subarray((y - 1) * stride, y * stride) : null
    for (let x = 0; x < stride; x++) {
      const a = x >= channels ? cur[x - channels] : 0
      const b = prev ? prev[x] : 0
      const c = prev && x >= channels ? prev[x - channels] : 0
      let v = line[x]
      switch (filter) {
        case 0: break
        case 1: v = (v + a) & 0xff; break
        case 2: v = (v + b) & 0xff; break
        case 3: v = (v + ((a + b) >> 1)) & 0xff; break
        case 4: {
          const p = a + b - c
          const pa = Math.abs(p - a)
          const pb = Math.abs(p - b)
          const pc = Math.abs(p - c)
          v = (v + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c)) & 0xff
          break
        }
        default: throw new Error(`bad filter ${filter}`)
      }
      cur[x] = v
    }
  }
  return { width, height, channels, data: out }
}

for (const file of process.argv.slice(2)) {
  const img = decode(readFileSync(file))
  let sum = 0
  let n = 0
  const { channels, data } = img
  for (let i = 0; i < data.length; i += channels) {
    sum += 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]
    n++
  }
  const avg = sum / n
  // 以左上角像素为背景基准，统计"有内容"的像素占比，用于确认页面不是空白
  const bg = 0.299 * data[0] + 0.587 * data[1] + 0.114 * data[2]
  let ink = 0
  for (let i = 0; i < data.length; i += channels) {
    const lum = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]
    if (Math.abs(lum - bg) > 10) ink++
  }
  const inkPct = (ink / n) * 100
  console.log(
    `${file.split(/[\\/]/).pop().padEnd(22)} ${img.width}x${img.height}  avg=${avg.toFixed(1)}  ${avg > 128 ? 'LIGHT' : 'DARK'}  ink=${inkPct.toFixed(1)}%${inkPct < 0.5 ? '  (疑似空白!)' : ''}`,
  )
}
