import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { BrowserWindow, nativeTheme } from 'electron'
import { IPC } from '@shared/ipc'
import type { AppPrefs, ThemeMode } from '@shared/types'

/** 与 CSS 变量保持一致，避免窗口出现瞬间白/闪烁 */
const WINDOW_BG: Record<'light' | 'dark', string> = {
  dark: '#121316',
  light: '#fafafa'
}

const DEFAULT_PREFS: AppPrefs = {
  theme: 'system',
  activeSpaceId: null,
  captureShortcut: true,
  fullscreenGuard: true
}

let prefsFile = ''

export function initPrefs(file: string): void {
  prefsFile = file
  if (!existsSync(dirname(file))) mkdirSync(dirname(file), { recursive: true })
}

export function getPrefs(): AppPrefs {
  try {
    if (prefsFile && existsSync(prefsFile)) {
      const parsed = JSON.parse(readFileSync(prefsFile, 'utf-8')) as Partial<AppPrefs>
      return { ...DEFAULT_PREFS, ...parsed }
    }
  } catch {
    /* 偏好文件损坏时回退默认值 */
  }
  return { ...DEFAULT_PREFS }
}

function write(next: AppPrefs): AppPrefs {
  try {
    writeFileSync(prefsFile, JSON.stringify(next, null, 2), 'utf-8')
  } catch {
    /* 写入失败不影响运行 */
  }
  return next
}

export function setTheme(theme: ThemeMode): AppPrefs {
  return write({ ...getPrefs(), theme })
}

export function setPrefs(patch: Partial<AppPrefs>): AppPrefs {
  return write({ ...getPrefs(), ...patch })
}

/** 记住当前所在空间（跨窗口共享：快速捕获窗口也用得到） */
export function setActiveSpace(id: string | null): AppPrefs {
  return setPrefs({ activeSpaceId: id })
}

/** 偏好变更广播：托盘 / 设置弹窗两处开关要互相看见对方的改动 */
export function broadcastPrefsChanged(): void {
  const prefs = getPrefs()
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) win.webContents.send(IPC.PREFS_CHANGED, prefs)
  }
}

export function prefsPath(): string {
  return prefsFile
}

/** 应用主题：同步 Electron 原生主题与所有窗口背景色 */
export function applyTheme(mode: ThemeMode): void {
  nativeTheme.themeSource = mode
  const bg = WINDOW_BG[nativeTheme.shouldUseDarkColors ? 'dark' : 'light']
  for (const win of BrowserWindow.getAllWindows()) win.setBackgroundColor(bg)
}

export function resolvedTheme(): 'light' | 'dark' {
  return nativeTheme.shouldUseDarkColors ? 'dark' : 'light'
}
