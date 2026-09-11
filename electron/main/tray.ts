import { join } from 'node:path'
import { Menu, Tray, app, nativeImage } from 'electron'
import type { MenuItem, MenuItemConstructorOptions } from 'electron'
import { getPrefs } from './prefs'
import { CAPTURE_SHORTCUT, setCaptureShortcutEnabled, setFullscreenGuardEnabled } from './shortcut'
import { appState } from './state'
import { checkForUpdatesWithFeedback, getUpdateStatus } from './updater'
import { requestNewTask, showCaptureWindow, showMainWindow } from './windows'

function iconPath(): string {
  if (app.isPackaged) return join(process.resourcesPath, 'resources', 'tray.png')
  return join(__dirname, '../../resources/tray.png')
}

let tray: Tray | null = null
let onPrefsChanged: (() => void) | null = null

/**
 * 托盘菜单每次都按当前偏好重建：开关项要反映设置弹窗里的改动，
 * 而 Menu 构建后不可变，只能整棵重建（Windows 上代价极小）。
 */
function buildMenu(): Menu {
  const prefs = getPrefs()

  const toggle = (apply: (enabled: boolean) => void) => {
    // checkbox 项点击时 Electron 已经把新状态写到 item.checked
    return (item: MenuItem): void => {
      apply(item.checked)
      refreshTrayMenu()
      onPrefsChanged?.()
    }
  }

  const template: MenuItemConstructorOptions[] = [
    {
      label: `快速捕获    ${CAPTURE_SHORTCUT}`,
      click: () => showCaptureWindow()
    },
    { type: 'separator' },
    {
      label: `启用快速捕获快捷键（${CAPTURE_SHORTCUT}）`,
      type: 'checkbox',
      checked: prefs.captureShortcut,
      click: toggle(setCaptureShortcutEnabled)
    },
    {
      label: '全屏程序时屏蔽快捷键',
      type: 'checkbox',
      checked: prefs.fullscreenGuard,
      click: toggle(setFullscreenGuardEnabled)
    },
    { type: 'separator' },
    {
      label: '打开主窗口',
      click: () => showMainWindow()
    },
    {
      label: '新建任务',
      click: () => requestNewTask()
    },
    { type: 'separator' },
    {
      // 有已下载的版本时直接提示重启安装，否则就是普通检查
      label: updateLabel(),
      click: () => {
        const status = getUpdateStatus()
        if (status.phase === 'downloaded') showMainWindow()
        else void checkForUpdatesWithFeedback()
      }
    },
    { type: 'separator' },
    {
      label: '退出',
      click: () => {
        appState.quitting = true
        app.quit()
      }
    }
  ]
  return Menu.buildFromTemplate(template)
}

/** 托盘菜单里那行更新的文案：跟着状态走，省得用户点进去才知道结果 */
function updateLabel(): string {
  const status = getUpdateStatus()
  if (!status.enabled) return `检查更新…（v${status.currentVersion}）`
  switch (status.phase) {
    case 'checking':
      return '正在检查更新…'
    case 'available':
      return `发现新版本 v${status.version}（去更新）`
    case 'downloading':
      return `正在下载更新 ${status.percent}%`
    case 'downloaded':
      return `v${status.version} 已就绪（重启安装）`
    case 'not-available':
      return `已是最新版本（v${status.currentVersion}）`
    case 'error':
      return '检查更新失败（重试）'
    default:
      return `检查更新…（v${status.currentVersion}）`
  }
}

export function refreshTrayMenu(): void {
  tray?.setContextMenu(buildMenu())
}

/**
 * @param prefsChanged 偏好被托盘菜单改动后的通知（用于广播给渲染进程，保持两处开关一致）
 */
export function createTray(prefsChanged?: () => void): Tray {
  onPrefsChanged = prefsChanged ?? null
  const image = nativeImage.createFromPath(iconPath())
  const instance = new Tray(
    image.isEmpty() ? nativeImage.createEmpty() : image.resize({ width: 16, height: 16 })
  )
  instance.setToolTip('Todo Tracker')
  instance.setContextMenu(buildMenu())
  instance.on('click', () => showMainWindow())
  tray = instance
  return instance
}
