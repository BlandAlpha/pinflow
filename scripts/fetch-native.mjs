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
      download(url, tmp)
      mkdirSync(releaseDir, { recursive: true })
      // 覆盖前先清掉旧产物，避免 Node ABI 那份被留在原地
      rmSync(target, { force: true })
      // --force-local 是 GNU tar 专有选项（Windows 上避免把 D:\... 当远程主机名），
      // macOS 自带的 BSD tar 不认它，会直接报 unknown option
      const tarArgs = ['-xzf', tmp.replace(/\\/g, '/'), '-C', outDir.replace(/\\/g, '/')]
      if (platform === 'win32') tarArgs.unshift('--force-local')
      const r = spawnSync('tar', tarArgs, { encoding: 'utf8' })
      if (r.status !== 0) throw new Error('tar 解压失败: ' + r.stderr)
      if (!existsSync(target)) {
        throw new Error('压缩包中缺少 better_sqlite3.node')
      }
      console.log('[native] 完成:', target)
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
