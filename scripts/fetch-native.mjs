/**
 * 获取 better-sqlite3 的官方预编译二进制（Electron ABI 版本）。
 *
 * 本机没有 MSVC / node-gyp 编译环境，因此不通过源码构建，
 * 而是直接从发布产物下载与当前 Electron ABI 匹配的 .node 文件。
 *
 * 下载用 curl（自动遵循系统代理），解压用纯 Node 实现 —— 不调用系统 tar。
 *
 * 用法：node scripts/fetch-native.mjs [--force]
 *   --force  即使现有二进制在 Electron 里可用，也重新下载一份
 *
 * 注意：npm install 装出来的是 Node ABI 版本，跑 dev 会因 NODE_MODULE_VERSION
 * 不匹配而起不来窗口，所以每次 npm install 之后都要跑一次本脚本。
 */
import { spawnSync } from 'node:child_process'
import { gunzipSync } from 'node:zlib'
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const VERSION = JSON.parse(
  readFileSync(join(ROOT, 'node_modules/better-sqlite3/package.json'), 'utf8')
).version

const platform = process.platform
const arch = process.arch === 'x64' ? 'x64' : process.arch
/** --force：即使现有二进制在 Electron 里能跑，也重新下载一份 */
const force = process.argv.includes('--force')

/** Electron 可执行文件路径：macOS 在 .app 包内，Windows 带 .exe 后缀 */
function electronBinary() {
  if (platform === 'darwin') {
    return join(ROOT, 'node_modules/electron/dist/Electron.app/Contents/MacOS/Electron')
  }
  const base = join(ROOT, 'node_modules/electron/dist/electron')
  return platform === 'win32' ? `${base}.exe` : base
}

function electronAbi() {
  const exe = electronBinary()
  if (!existsSync(exe)) throw new Error('未找到 Electron 二进制，请先执行 npm install')
  const out = spawnSync(exe, ['-e', 'process.stdout.write(String(process.versions.modules))'], {
    env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' },
    encoding: 'utf8'
  })
  const abi = (out.stdout || '').trim()
  if (!abi) throw new Error('无法读取 Electron ABI：' + (out.stderr || ''))
  return abi
}

/**
 * 现有的 better_sqlite3.node 能不能在 Electron 里用？
 *
 * 必须真的 `new Database(':memory:')` —— 光 require('better-sqlite3') 只加载 JS 外壳，
 * 原生模块是在构造实例时才 dlopen 的，看不出来 ABI 对不对。
 * npm install 装出来的是 Node ABI 版本，直接跑 dev 会报 NODE_MODULE_VERSION 不匹配。
 */
function nativeUsable() {
  const probe = spawnSync(
    electronBinary(),
    [
      '-e',
      "try{const D=require('better-sqlite3');new D(':memory:').close();console.log('OK')}catch(e){console.log('FAIL:'+String(e.message).split('\\n')[0])}"
    ],
    {
      cwd: ROOT,
      env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' },
      encoding: 'utf8'
    }
  )
  const out = (probe.stdout || '').trim()
  if (out === 'OK') return true
  console.log('[native] 现有二进制不可用：', out || (probe.stderr || '').trim())
  return false
}

const abi = electronAbi()
const file = `better-sqlite3-v${VERSION}-electron-v${abi}-${platform}-${arch}.tar.gz`
const targets = [
  `https://github.com/WiseLibs/better-sqlite3/releases/download/v${VERSION}/${file}`,
  `https://registry.npmmirror.com/-/binary/better-sqlite3/v${VERSION}/${file}`
]

const outDir = join(ROOT, 'node_modules/better-sqlite3')
const releaseDir = join(outDir, 'build/Release')

/** 用 curl 下载到内存（自动遵循系统代理配置） */
function download(url) {
  const r = spawnSync('curl', ['-sSL', '--fail', url], {
    // spawnSync 的 maxBuffer 默认只有 1MB，压缩包约 2MB，不放大直接爆掉
    maxBuffer: 64 * 1024 * 1024
  })
  if (r.status !== 0 || !r.stdout || r.stdout.length === 0) {
    const err = (r.stderr || Buffer.alloc(0)).toString('utf8').trim()
    throw new Error(`curl 下载失败 (${r.status}): ${err}`)
  }
  return r.stdout
}

/**
 * 解压 .tar.gz —— 纯 Node 实现，不调用系统 tar。
 *
 * 踩过的坑：Windows runner 上的 tar 是 bsdtar，不认 GNU tar 的 --force-local
 * （macOS 自带的同样是 bsdtar，两边行为还不一致）。而这个包里其实只有一个 .node
 * 文件，与其跟不同实现较劲，不如在内存里解开 —— 顺带消掉了全部平台分支。
 */
function extractTarGz(gz, destDir) {
  const tar = gunzipSync(gz)
  let count = 0
  for (let offset = 0; offset + 512 <= tar.length; ) {
    const header = tar.subarray(offset, offset + 512)
    if (header.every((b) => b === 0)) break // 全零块 = 归档结束

    const field = (start, len) =>
      header
        .subarray(start, start + len)
        .toString('utf8')
        .replace(/\0[\s\S]*$/, '')
        .trim()
    const name = field(0, 100)
    const prefix = field(345, 155)
    const size = parseInt(field(124, 12), 8) || 0
    const type = String.fromCharCode(header[156])
    const dataStart = offset + 512
    // 文件数据按 512 字节对齐，下一个头从这里开始
    offset = dataStart + Math.ceil(size / 512) * 512

    // pax / gnu 扩展头只描述下一个文件，本身不落地
    if (!name || type === 'x' || type === 'g' || type === 'L') continue
    const path = join(destDir, prefix ? `${prefix}/${name}` : name)
    if (type === '5' || name.endsWith('/')) {
      mkdirSync(path, { recursive: true })
      continue
    }
    if (type !== '0' && type !== '') continue // 只取普通文件，软链之类忽略
    mkdirSync(dirname(path), { recursive: true })
    writeFileSync(path, tar.subarray(dataStart, dataStart + size))
    count += 1
  }
  return count
}

async function main() {
  const target = join(releaseDir, 'better_sqlite3.node')
  // 只看「文件在不在」是不够的：npm install 会用 Node ABI 编一份出来，
  // 那份文件在 Electron 里根本 dlopen 不了（NODE_MODULE_VERSION 不匹配）
  if (!force && existsSync(target) && nativeUsable()) {
    console.log('[native] 已存在可用的（Electron ABI）预编译二进制，跳过')
    return
  }
  if (force) console.log('[native] --force：忽略现有二进制，强制重新下载')
  let lastErr
  for (const url of targets) {
    try {
      console.log('[native] 下载:', url)
      const archive = download(url)
      mkdirSync(releaseDir, { recursive: true })
      // 覆盖前先清掉旧产物，避免 Node ABI 那份被留在原地
      rmSync(target, { force: true })
      const extracted = extractTarGz(archive, outDir)
      if (!existsSync(target)) {
        throw new Error(`压缩包中缺少 better_sqlite3.node（共解出 ${extracted} 个文件）`)
      }
      console.log('[native] 完成:', target)
      return
    } catch (err) {
      lastErr = err
      console.warn('[native] 失败:', err.message)
    }
  }
  throw lastErr
}

main().catch((err) => {
  console.error('[native] 无法获取预编译二进制:', err.message)
  process.exit(1)
})
