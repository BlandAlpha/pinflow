import { join } from 'node:path'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { BrowserWindow, app, nativeImage, screen } from 'electron'
import { resolvedTheme } from './prefs'
import { appState } from './state'

interface WindowStateFile {
  main?: { x: number; y: number; width: number; height: number; maximized: boolean }
  capture?: { x: number; y: number }
}

let mainWindow: BrowserWindow | null = null
let captureWindow: BrowserWindow | null = null
let stateFile = ''

function statePath(): string {
  if (!stateFile) {
    const dir = app.getPath('userData')
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
    stateFile = join(dir, 'window-state.json')
  }
  return stateFile
}

function readState(): WindowStateFile {
  try {
    if (existsSync(statePath())) return JSON.parse(readFileSync(statePath(), 'utf-8'))
  } catch {
    /* 忽略损坏的状态文件 */
  }
  return {}
}

function writeState(patch: WindowStateFile): void {
  try {
    writeFileSync(statePath(), JSON.stringify({ ...readState(), ...patch }, null, 2), 'utf-8')
  } catch {
    /* 状态持久化失败不影响使用 */
  }
}

/** 应用图标：窗口标题栏与任务栏都用它，取代 Electron 默认图标 */
function appIcon(): Electron.NativeImage | undefined {
  const file = app.isPackaged
    ? join(process.resourcesPath, 'resources', 'icon.png')
    : join(__dirname, '../../resources/icon.png')
  const image = nativeImage.createFromPath(file)
  return image.isEmpty() ? undefined : image
}

export function getMainWindow(): BrowserWindow | null {
  return mainWindow
}

export function getCaptureWindow(): BrowserWindow | null {
  return captureWindow
}

export function createMainWindow(): BrowserWindow {
  const state = readState().main
  const win = new BrowserWindow({
    width: state?.width ?? 1180,
    height: state?.height ?? 760,
    minWidth: 900,
    minHeight: 600,
    x: state?.x,
    y: state?.y,
    frame: false,
    backgroundColor: resolvedTheme() === 'dark' ? '#121316' : '#fafafa',
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })

  if (state?.maximized) win.maximize()

  win.once('ready-to-show', () => win.show())
  win.on('close', (e) => {
    // 关闭主窗口 = 最小化到托盘，不退出进程
    if (!appState.quitting) {
      e.preventDefault()
      win.hide()
      return
    }
    writeState({
      main: {
        ...win.getBounds(),
        maximized: win.isMaximized()
      }
    })
  })
  win.on('closed', () => {
    mainWindow = null
  })

  loadRenderer(win, 'index.html')
  mainWindow = win
  return win
}

export function createCaptureWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 640,
    height: 116,
    frame: false,
    resizable: false,
    movable: true,
    skipTaskbar: true,
    alwaysOnTop: true,
    fullscreenable: false,
    icon: appIcon(),
    backgroundColor: resolvedTheme() === 'dark' ? '#121316' : '#fafafa',
    show: false,
    webPreferences: {
      preload: join(__dirname, '../preload/capture.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })

  win.on('blur', () => {
    if (win.isVisible() && !win.webContents.isDevToolsFocused()) hideCaptureWindow()
  })
  win.on('moved', () => {
    const [x, y] = win.getPosition()
    writeState({ capture: { x, y } })
  })
  win.on('closed', () => {
    captureWindow = null
  })

  loadRenderer(win, 'capture.html')
  captureWindow = win
  return win
}

/** 显示快速捕获窗口：复用已有实例，位置居中于当前光标所在屏幕 */
export function showCaptureWindow(): void {
  const win = captureWindow ?? createCaptureWindow()
  if (!win.webContents.getURL()) loadRenderer(win, 'capture.html')

  const saved = readState().capture
  const point = screen.getCursorScreenPoint()
  const display = screen.getDisplayNearestPoint(point)
  const [w] = win.getSize()

  if (saved && displayContainsPoint(display, saved.x, saved.y)) {
    win.setPosition(saved.x, saved.y)
  } else {
    const x = Math.round(display.workArea.x + (display.workArea.width - w) / 2)
    const y = Math.round(display.workArea.y + display.workArea.height * 0.22)
    win.setPosition(x, y)
  }

  win.show()
  win.focus()
  win.webContents.send('capture:ready')
}

export function hideCaptureWindow(): void {
  if (captureWindow && captureWindow.isVisible()) captureWindow.hide()
}

export function showMainWindow(): void {
  const win = mainWindow ?? createMainWindow()
  if (win.isMinimized()) win.restore()
  if (!win.isVisible()) win.show()
  win.focus()
}

export function minimizeMainWindow(): void {
  const win = getMainWindow()
  if (win) win.minimize()
}

export function toggleMaximizeMainWindow(): void {
  const win = getMainWindow()
  if (!win) return
  if (win.isMaximized()) win.unmaximize()
  else win.maximize()
}

export function closeMainWindow(): void {
  const win = getMainWindow()
  if (win) win.close()
}

function displayContainsPoint(
  display: ReturnType<typeof screen.getDisplayNearestPoint>,
  x: number,
  y: number
): boolean {
  const a = display.workArea
  return x >= a.x - 40 && x <= a.x + a.width && y >= a.y - 40 && y <= a.y + a.height
}

function loadRenderer(win: BrowserWindow, file: 'index.html' | 'capture.html'): void {
  const devUrl = process.env['ELECTRON_RENDERER_URL']
  if (devUrl) {
    void win.loadURL(`${devUrl}/${file}`)
    return
  }
  void win.loadFile(join(__dirname, '../renderer', file))
}
