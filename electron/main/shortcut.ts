import { globalShortcut } from 'electron'
import type { ShortcutState } from '@shared/types'
import { getPrefs, setPrefs } from './prefs'
import {
  disposeFullscreenWatch,
  isFullscreenActive,
  startFullscreenWatch,
  stopFullscreenWatch
} from './fullscreen'

/**
 * 全局快速捕获快捷键
 *
 * 两处开关（设置弹窗 / 托盘右键菜单）都落在 prefs.json：
 * - captureShortcut：是否启用快捷键
 * - fullscreenGuard：前台是全屏程序时自动屏蔽，防游戏误触（默认开，仅 Windows 生效）
 *
 * 任何时候都只以 prefs + 当前全屏状态推导出"该不该注册"，注册动作集中在这里，
 * 避免出现"设置说开着、实际没注册"这类对不上的状态。
 */

export const CAPTURE_SHORTCUT = 'Ctrl+Shift+Space'

let trigger: (() => void) | null = null
let registered = false

/** 当前是否处于「被全屏程序屏蔽」状态 */
function suspendedByFullscreen(): boolean {
  const prefs = getPrefs()
  return prefs.captureShortcut && prefs.fullscreenGuard && isFullscreenActive()
}

/** 按 prefs 与全屏状态注册/注销快捷键，返回注册结果 */
export function syncShortcut(): boolean {
  const prefs = getPrefs()
  const want = !!trigger && prefs.captureShortcut && !suspendedByFullscreen()

  if (want && !registered) {
    registered = globalShortcut.register(CAPTURE_SHORTCUT, () => trigger?.())
    if (!registered) {
      console.warn(`[TodoTracker] 全局快捷键注册失败（可能被其它程序占用）: ${CAPTURE_SHORTCUT}`)
    }
  } else if (!want && registered) {
    globalShortcut.unregister(CAPTURE_SHORTCUT)
    registered = false
  }
  return registered
}

export function getShortcutState(): ShortcutState {
  const prefs = getPrefs()
  return {
    enabled: prefs.captureShortcut,
    registered,
    suspendedByFullscreen: suspendedByFullscreen()
  }
}

/** 全屏状态变化时同步注册状态（由 fullscreen 模块回调） */
function onFullscreenChange(): void {
  syncShortcut()
}

/** 全屏监听只在开启屏蔽且处于 Windows 时跑，省一个常驻子进程 */
function syncFullscreenWatch(): void {
  const prefs = getPrefs()
  if (prefs.captureShortcut && prefs.fullscreenGuard) startFullscreenWatch(onFullscreenChange)
  else stopFullscreenWatch()
}

export function initShortcut(onTrigger: () => void): void {
  trigger = onTrigger
  syncShortcut()
  syncFullscreenWatch()
}

export function setCaptureShortcutEnabled(enabled: boolean): void {
  setPrefs({ captureShortcut: enabled })
  syncShortcut()
  syncFullscreenWatch()
}

export function setFullscreenGuardEnabled(enabled: boolean): void {
  setPrefs({ fullscreenGuard: enabled })
  syncFullscreenWatch()
  syncShortcut()
}

/** 退出前清理：注销快捷键 + 停掉全屏检测子进程 */
export function disposeShortcut(): void {
  trigger = null
  registered = false
  globalShortcut.unregisterAll()
  disposeFullscreenWatch()
}
