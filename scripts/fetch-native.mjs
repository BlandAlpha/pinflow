/**
 * 获取 better-sqlite3 的官方预编译二进制（Electron ABI 版本）。
 *
 * 本机没有 MSVC / node-gyp 编译环境，因此不通过源码构建，
 * 而是直接从发布产物下载与当前 Electron ABI 匹配的 .node 文件。
 *
 * 用法：node scripts/fetch-native.mjs
 */
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { mkdirSync, existsSync, rmSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
// pipeline unused
// Readable unused

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const VERSION = JSON.parse(
  readFileSync(join(ROOT, 'node_modules/better-sqlite3/package.json'), 'utf8')
).version

const platform = process.platform
const arch = process.arch === 'x64' ? 'x64' : process.arch

function electronAbi() {
  const electronPkg = join(ROOT, 'node_modules/electron/package.json')
  const electronPath = join(ROOT, 'node_modules/electron/dist/electron')
  const exe = platform === 'win32' ? `${electronPath}.exe` : electronPath
  if (!existsSync(exe)) throw new Error('未找到 Electron 二进制，请先执行 npm install')
  const out = spawnSync(exe, ['-e', 'process.stdout.write(String(process.versions.modules))'], {
    env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' },
    encoding: 'utf8'
  })
  const abi = (out.stdout || '').trim()
  if (!abi) throw new Error('无法读取 Electron ABI：' + (out.stderr || ''))
  return abi
}

const abi = electronAbi()
const file = `better-sqlite3-v${VERSION}-electron-v${abi}-${platform}-${arch}.tar.gz`
const targets = [
  `https://github.com/WiseLibs/better-sqlite3/releases/download/v${VERSION}/${file}`,
  `https://registry.npmmirror.com/-/binary/better-sqlite3/v${VERSION}/${file}`
]

const outDir = join(ROOT, 'node_modules/better-sqlite3')
const releaseDir = join(outDir, 'build/Release')
const tmp = join(ROOT, '.native-cache', file)

/** 使用 curl 下载（自动遵循系统代理配置） */
function download(url, dest) {
  mkdirSync(dirname(dest), { recursive: true })
  const r = spawnSync('curl', ['-sSL', '--fail', '-o', dest, url], { encoding: 'utf8' })
  if (r.status !== 0 || !existsSync(dest)) {
    throw new Error(`curl 下载失败 (${r.status}): ${r.stderr || ''}`)
  }
}

async function main() {
  if (existsSync(join(releaseDir, 'better_sqlite3.node'))) {
    console.log('[native] 已存在预编译二进制，跳过')
    return
  }
  let lastErr
  for (const url of targets) {
    try {
      console.log('[native] 下载:', url)
      download(url, tmp)
      mkdirSync(releaseDir, { recursive: true })
      const r = spawnSync(
        'tar',
        ['--force-local', '-xzf', tmp.replace(/\\/g, '/'), '-C', outDir.replace(/\\/g, '/')],
        { encoding: 'utf8' }
      )
      if (r.status !== 0) throw new Error('tar 解压失败: ' + r.stderr)
      if (!existsSync(join(releaseDir, 'better_sqlite3.node'))) {
        throw new Error('压缩包中缺少 better_sqlite3.node')
      }
      console.log('[native] 完成:', join(releaseDir, 'better_sqlite3.node'))
      rmSync(dirname(tmp), { recursive: true, force: true })
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
