import { join } from 'node:path'
import { existsSync } from 'node:fs'
import { BrowserWindow, Notification, app } from 'electron'
import { autoUpdater } from 'electron-updater'
import { IPC } from '@shared/ipc'
import type { UpdateStatus } from '@shared/types'

/**
 * 应用内更新（electron-updater + generic provider）。
 *
 * 更新源地址不在这里：它被写进随包分发的 `resources/app-update.yml`，
 * 由 forge.config.js 里 nsis maker 的 `updater.url` 在构建时注入
 * （CI 用环境变量 UPDATE_BASE_URL 覆盖）。所以换 CDN 不需要改这个文件。
 *
 * 更新能力只在「已打包 且 app-update.yml 存在」时可用：
 * - 源码态（npm run dev）没有该文件；
 * - `npm run package` 产出的免安装目录也没有（只有 make 出的安装包里有，
 *   maker 是在打安装包时才把 app-update.yml 塞进 resources）。
 * 两种情况都如实显示为不可用，而不是让用户点了按钮收到一串 ENOENT。
 */

/** 启动后延迟多久做静默检查：避开首帧渲染与数据库初始化 */
const STARTUP_CHECK_DELAY_MS = 8000

let status: UpdateStatus = {
  phase: 'idle',
  currentVersion: '0.0.0',
  version: null,
  percent: 0,
  message: null,
  enabled: false
}

let initialized = false
let startupTimer: NodeJS.Timeout | null = null
/** 状态变化通知（用来重建托盘菜单：菜单文案要跟着状态走） */
let onStatusChanged: (() => void) | null = null

function broadcast(): void {
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) win.webContents.send(IPC.UPDATE_STATUS_CHANGED, status)
  }
  onStatusChanged?.()
}

/** 唯一的写入口：改完立刻广播，渲染层永远看到同一份状态 */
function setStatus(patch: Partial<UpdateStatus>): UpdateStatus {
  status = { ...status, ...patch }
  broadcast()
  return status
}

export function getUpdateStatus(): UpdateStatus {
  return status
}

/** 随包分发的更新器配置（provider / url / channel 都在里面） */
function updateConfigPath(): string {
  // 纯 Node 环境（单测）没有 resourcesPath，空串兜底即可
  return join(process.resourcesPath ?? '', 'app-update.yml')
}

function updaterAvailable(): boolean {
  return app.isPackaged && existsSync(updateConfigPath())
}

/** 把 electron-updater 的错误转成人话，别把 stack 丢进设置面板 */
function describe(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err)
  if (/ENOTFOUND|ENETUNREACH|ETIMEDOUT|ECONNREFUSED|ECONNRESET|getaddrinfo|socket hang up/i.test(msg)) {
    return '无法连接更新服务器，请检查网络'
  }
  if (/\b404\b/.test(msg)) return '更新源上还没有发布版本'
  if (/sha512|checksum/i.test(msg)) return '安装包校验失败，请重试'
  return msg.split('\n')[0].slice(0, 200)
}

export function initUpdater(statusChanged?: () => void): void {
  onStatusChanged = statusChanged ?? null
  status = {
    ...status,
    currentVersion: app.getVersion(),
    enabled: updaterAvailable()
  }
  broadcast()

  if (!status.enabled || initialized) return
  initialized = true

  // 下载交给用户确认：弱网/流量环境下自动下 90MB 安装包不合适
  autoUpdater.autoDownload = false
  // 但已经下载完的更新，用户直接退出时也顺手装上
  autoUpdater.autoInstallOnAppQuit = true

  autoUpdater.on('checking-for-update', () => setStatus({ phase: 'checking', message: null }))
  autoUpdater.on('update-available', (info) =>
    setStatus({ phase: 'available', version: info.version, percent: 0, message: null })
  )
  autoUpdater.on('update-not-available', () =>
    setStatus({ phase: 'not-available', version: null, percent: 0, message: null })
  )
  autoUpdater.on('download-progress', (p) =>
    setStatus({ phase: 'downloading', percent: Math.round(p.percent) })
  )
  autoUpdater.on('update-downloaded', (info) =>
    setStatus({ phase: 'downloaded', version: info.version, percent: 100 })
  )
  autoUpdater.on('error', (err) => setStatus({ phase: 'error', message: describe(err) }))

  startupTimer = setTimeout(() => void checkForUpdates(), STARTUP_CHECK_DELAY_MS)
  // 定时器不该拖着进程不退出
  startupTimer.unref?.()
}

/** 退出前清掉定时器：否则 before-quit 之后还会触发一次网络请求 */
export function disposeUpdater(): void {
  if (startupTimer) {
    clearTimeout(startupTimer)
    startupTimer = null
  }
}

export async function checkForUpdates(): Promise<UpdateStatus> {
  if (!status.enabled) return status
  try {
    await autoUpdater.checkForUpdates()
  } catch (err) {
    setStatus({ phase: 'error', message: describe(err) })
  }
  return status
}

export async function downloadUpdate(): Promise<UpdateStatus> {
  if (!status.enabled) return status
  // 已经下过就别重复下（用户可能反复点）
  if (status.phase === 'downloading' || status.phase === 'downloaded') return status
  setStatus({ phase: 'downloading', percent: 0, message: null })
  try {
    await autoUpdater.downloadUpdate()
  } catch (err) {
    setStatus({ phase: 'error', message: describe(err) })
  }
  return status
}

export function installUpdate(): void {
  // 只有下载完成才允许重启安装，避免把不完整的状态带进安装流程
  if (status.phase !== 'downloaded') return
  // silent=true → NSIS 收到 /S 静默安装，不会再弹一遍安装向导
  // forceRunAfter=true → 装完自动拉起新版本
  autoUpdater.quitAndInstall(true, true)
}

function notify(title: string, body: string): void {
  if (!Notification.isSupported()) return
  new Notification({ title, body, silent: true }).show()
}

/**
 * 托盘菜单用：检查完给一条系统通知。
 * 主窗口可能是隐藏的，没有反馈用户会以为「点了没反应」。
 */
export async function checkForUpdatesWithFeedback(): Promise<UpdateStatus> {
  if (!status.enabled) {
    notify('PinFlow', '当前版本不支持自动更新（开发版或免安装版）')
    return status
  }
  await checkForUpdates()
  if (status.phase === 'available') {
    notify('发现新版本', `v${status.version} 可更新，打开「设置 → 更新」即可下载`)
  } else if (status.phase === 'not-available') {
    notify('PinFlow', `已是最新版本 v${status.currentVersion}`)
  } else if (status.phase === 'error') {
    notify('检查更新失败', status.message ?? '未知错误')
  }
  return status
}
