import { join } from 'node:path'
import { Menu, Tray, app, nativeImage } from 'electron'
import { appState } from './state'
import { showCaptureWindow, showMainWindow } from './windows'

function iconPath(): string {
  if (app.isPackaged) return join(process.resourcesPath, 'resources', 'tray.png')
  return join(__dirname, '../../resources/tray.png')
}

export function createTray(): Tray {
  const image = nativeImage.createFromPath(iconPath())
  const tray = new Tray(image.isEmpty() ? nativeImage.createEmpty() : image.resize({ width: 16, height: 16 }))
  tray.setToolTip('Todo Tracker')

  const menu = Menu.buildFromTemplate([
    {
      label: '快速捕获    Ctrl+Shift+Space',
      click: () => showCaptureWindow()
    },
    {
      label: '打开主窗口',
      click: () => showMainWindow()
    },
    { type: 'separator' },
    {
      label: '退出',
      click: () => {
        appState.quitting = true
        app.quit()
      }
    }
  ])
  tray.setContextMenu(menu)
  tray.on('click', () => showMainWindow())
  return tray
}
