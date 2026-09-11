import { join } from 'node:path'
import { rmSync } from 'node:fs'
import { app, nativeTheme } from 'electron'
import squirrelStartup from 'electron-squirrel-startup'
import { initDatabase, purgeExpiredArchived, refreshDueLevels } from './db'
import { broadcastDataChanged, broadcastTheme, registerIpcHandlers } from './ipc'
import { applyTheme, broadcastPrefsChanged, getPrefs, initPrefs, setTheme } from './prefs'
import { CAPTURE_SHORTCUT, disposeShortcut, initShortcut } from './shortcut'
import { appState } from './state'
import { createTray, refreshTrayMenu } from './tray'
import { createMainWindow, showCaptureWindow, showMainWindow } from './windows'
import { disposeUpdater, initUpdater } from './updater'

// Squirrel（Windows 安装/更新）在首次安装、升级、卸载时会以特殊参数启动本进程，
// 这些阶段必须立即退出，否则安装程序会卡住。
if (squirrelStartup) {
  app.quit()
}

const singleInstance = app.requestSingleInstanceLock()
if (!singleInstance) {
  app.quit()
} else {
  app.on('second-instance', () => {
    showMainWindow()
  })

  app.whenReady().then(() => {
    // 0. 冒烟测试使用独立数据目录
    if (process.argv.includes('--smoke')) {
      app.setPath('userData', join(app.getPath('userData'), 'smoke'))
      if (process.argv.includes('--smoke-reset')) {
        for (const f of ['todo.db', 'todo.db-shm', 'todo.db-wal', 'prefs.json']) {
          rmSync(join(app.getPath('userData'), f), { force: true })
        }
      }
    }

    // 1. 本地偏好（主题）与数据库
    initPrefs(join(app.getPath('userData'), 'prefs.json'))
    // 冒烟测试可用参数强制主题（必须在 initPrefs 之后才能落盘）
    if (process.argv.includes('--smoke-light')) setTheme('light')
    if (process.argv.includes('--smoke-dark')) setTheme('dark')
    applyTheme(getPrefs().theme)
    // 系统主题变化时同步给所有窗口
    nativeTheme.on('updated', () => broadcastTheme(getPrefs().theme))
    initDatabase(join(app.getPath('userData'), 'todo.db'))

    // 后台维护：过期归档清理（每小时）+ 截止时间驱动的重要度刷新（每 6 小时）
    const purge = () => {
      const removed = purgeExpiredArchived(30)
      if (removed > 0) {
        console.info(`[TodoTracker] 已自动清除 ${removed} 个超过 30 天的归档任务`)
        broadcastDataChanged()
      }
    }
    const refreshDue = () => {
      if (refreshDueLevels() > 0) broadcastDataChanged()
    }
    purge()
    refreshDue()
    setInterval(purge, 60 * 60 * 1000)
    setInterval(refreshDue, 6 * 60 * 60 * 1000)

    // 2. IPC
    registerIpcHandlers()

    // 3. 系统托盘（菜单里的开关改动后广播给窗口，保持与设置弹窗一致）
    createTray(() => broadcastPrefsChanged())

    // 4. 全局快速捕获（快捷键开关 + 全屏程序时自动屏蔽都在 shortcut 模块里管）
    initShortcut(() => showCaptureWindow())

    // 5. 主窗口（开机自启时静默到托盘，不弹首帧）
    //    --startup 是 Windows 原生自启项的参数，--hidden 是 electron-auto-launch
    //    （isHidden: true）在 macOS / Linux 上写入的参数
    createMainWindow({
      hidden: process.argv.includes('--startup') || process.argv.includes('--hidden')
    })

    // 6. 应用内更新：打包后延迟静默检查一次，结果体现在设置面板与托盘菜单
    initUpdater(() => refreshTrayMenu())

    // 7. 冒烟测试：--smoke 启动时自动截图并退出。
    //    只在未打包时加载：它会往 app.getAppPath()/.smoke 写文件，
    //    而打包后 app.getAppPath() 在 asar 内（只读）。
    if (!app.isPackaged && process.argv.includes('--smoke')) {
      void import('./smoke').then((m) => m.runSmokeTest(CAPTURE_SHORTCUT))
    }

    app.on('activate', () => {
      showMainWindow()
    })
  })

  app.on('window-all-closed', () => {
    // 有托盘常驻：全部窗口关闭也不退出进程
  })

  app.on('before-quit', () => {
    appState.quitting = true
    disposeShortcut()
    disposeUpdater()
  })
}
