import { join } from 'node:path'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { BrowserWindow, app, nativeImage, screen } from 'electron'
import { IPC } from '@shared/ipc'
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

/**
 * 创建主窗口。
 * @param options.hidden 开机自启场景下静默到托盘：首帧不展示，等托盘/快捷键显式唤起。
 */
export function createMainWindow(options: { hidden?: boolean } = {}): BrowserWindow {
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
    icon: appIcon(),
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

  // 注意：不能先 hide() 再等这个事件 —— 它会在首帧把窗口重新弹出来
  win.once('ready-to-show', () => {
    if (!options.hidden) win.show()
  })
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

/** 捕获面板内容尺寸 */
const CAPTURE_W = 640
const CAPTURE_H = 116
/** 四周透明边距：给渲染层画的阴影留出溢出空间（阴影 10px 偏移 + 32px 模糊 ≈ 26px 外溢） */
const CAPTURE_MARGIN = 28

export function createCaptureWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: CAPTURE_W + CAPTURE_MARGIN * 2,
    height: CAPTURE_H + CAPTURE_MARGIN * 2,
    frame: false,
    resizable: false,
    movable: true,
    skipTaskbar: true,
    alwaysOnTop: true,
    fullscreenable: false,
    icon: appIcon(),
    // 无边框：窗口本体透明，圆角与阴影全部交给渲染层绘制。
    // backgroundColor 必须全透明，否则整窗会被底色填充、透明度失效
    transparent: true,
    hasShadow: false,
    backgroundColor: '#00000000',
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

  // 幂等：已可见时只聚焦。全局快捷键按住会被系统自动重复，对可见的
  // 透明无边框窗口反复 show/setPosition，Windows 会按不可见边框 inset
  // 逐次把窗口撑大（表现为按住 Ctrl+Shift+Space 窗口无限变高）。
  if (win.isVisible()) {
    win.focus()
    return
  }

  const saved = readState().capture
  const point = screen.getCursorScreenPoint()
  const display = screen.getDisplayNearestPoint(point)
  const width = CAPTURE_W + CAPTURE_MARGIN * 2
  const height = CAPTURE_H + CAPTURE_MARGIN * 2
  const base = { width, height }

  // 每次显示都用显式尺寸落位：即使窗口被外部因素改过也能自愈
  if (saved && displayContainsPoint(display, saved.x, saved.y)) {
    win.setBounds({ x: saved.x, y: saved.y, ...base })
  } else {
    const x = Math.round(display.workArea.x + (display.workArea.width - width) / 2)
    const y = Math.round(display.workArea.y + display.workArea.height * 0.22)
    win.setBounds({ x, y, ...base })
  }

  win.show()
  win.focus()
  sendWhenReady(win, IPC.CAPTURE_READY)
}

export function hideCaptureWindow(): void {
  if (captureWindow && captureWindow.isVisible()) captureWindow.hide()
}

export function showMainWindow(): BrowserWindow {
  const win = mainWindow ?? createMainWindow()
  if (win.isMinimized()) win.restore()
  if (!win.isVisible()) win.show()
  win.focus()
  return win
}

/** 托盘「新建任务」：唤起主窗口并请求聚焦快速新增输入框 */
export function requestNewTask(): void {
  sendWhenReady(showMainWindow(), IPC.REQUEST_NEW_TASK)
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

/**
 * 向渲染进程发消息。
 * 页面还没加载完就挂到 did-finish-load 上，避免首帧就把消息丢掉
 * （首次弹出的捕获窗口、托盘唤起的主窗口都会遇到这个竞态）。
 */
function sendWhenReady(win: BrowserWindow, channel: string, ...args: unknown[]): void {
  const wc = win.webContents
  if (wc.isLoading() || !wc.getURL()) wc.once('did-finish-load', () => wc.send(channel, ...args))
  else wc.send(channel, ...args)
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
