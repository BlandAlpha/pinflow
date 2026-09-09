import { join } from 'node:path'
import { mkdirSync, writeFileSync } from 'node:fs'
import { app, globalShortcut } from 'electron'
import { initDatabase } from './db'
import { registerIpcHandlers } from './ipc'
import { appState } from './state'
import { createTray } from './tray'
import {
  createMainWindow,
  getCaptureWindow,
  getMainWindow,
  showCaptureWindow,
  showMainWindow
} from './windows'

/** 全局快捷键 */
const CAPTURE_SHORTCUT = 'Ctrl+Shift+Space'

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

/** 带超时的等待：冒烟测试中任何一步卡住都不能阻塞退出 */
function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T | null> {
  return Promise.race([
    p.catch((err) => {
      console.warn(`[smoke] ${label} 失败:`, err)
      return null
    }),
    sleep(ms).then(() => {
      console.warn(`[smoke] ${label} 超时`)
      return null
    })
  ])
}

/** 开发用：启动后自动写入示例数据、对各窗口截图、验证全局快捷键，然后退出 */
async function runSmokeTest(): Promise<void> {
  const log = (msg: string) => console.log(`[smoke] ${msg}`)
  const shotDir = join(app.getAppPath(), '.smoke')
  mkdirSync(shotDir, { recursive: true })

  // 冒烟测试使用独立数据目录，避免污染日常数据
  const db = await import('./db')
  log('start')
  log(`persistence: ${db.listTodos().length} todos already stored`)

  await sleep(1200)
  const t = db.createTodo({ title: '整理季度评审材料', importance: 'high', urgency: 'high' })
  db.createTodo({
    title: '准备 CRM 会议',
    dueAt: new Date(Date.now() + 3 * 3600 * 1000).toISOString()
  })
  db.createTodo({ title: '阅读 Electron 文档', importance: 'low', urgency: 'low' })
  const withSteps = db.createTodo({ title: '带步骤的任务：发布新版本' })
  db.addStep(withSteps.id, '更新版本号')
  db.addStep(withSteps.id, '打 tag')
  db.addStep(withSteps.id, '上传安装包')
  log(`created todos, id=${t.id}`)

  const main = getMainWindow()
  if (main) {
    // 刷新以载入新写入的示例数据（不 await，避免加载事件竞态阻塞）
    void main.webContents.reload()
    await sleep(2500)

    // 依次切换视图截图
    for (const v of ['today', 'matrix', 'all']) {
      await main.webContents.executeJavaScript(
        `document.querySelectorAll('nav button')[${v === 'today' ? 1 : v === 'matrix' ? 2 : 3}].click()`
      )
      await sleep(600)
      const img = await main.webContents.capturePage()
      writeFileSync(join(shotDir, `${v}.png`), img.toPNG())
      log(`shot ${v}`)
    }

    // 回到收件箱并打开详情
    await main.webContents.executeJavaScript(`document.querySelectorAll('nav button')[0].click()`)
    await sleep(300)
    await main.webContents.executeJavaScript(
      `document.querySelector('main [role="button"]')?.click()`
    )
    await sleep(700)
    const detail = await withTimeout(main.webContents.capturePage(), 5000, 'capture detail')
    if (detail) {
      writeFileSync(join(shotDir, 'detail.png'), detail.toPNG())
      log('shot detail')
    }

    const shortcutOk = globalShortcut.isRegistered(CAPTURE_SHORTCUT)
    writeFileSync(join(shotDir, 'shortcut.txt'), shortcutOk ? 'registered' : 'NOT-registered')
    log(`shortcut=${shortcutOk}`)
  }

  // 快速捕获窗口阶段。
  // 注：个别沙箱/自动化桌面会阻塞同一进程创建第二个窗口（用原生 Electron 可复现，
  // 与本应用代码无关）。在这类受限环境中跑冒烟测试时传 --skip-capture 跳过。
  if (process.argv.includes('--skip-capture')) {
    log('skip capture window phase')
    await sleep(200)
    log('done')
    appState.quitting = true
    app.exit(0)
  }

  log('before showCaptureWindow')
  showCaptureWindow()
  log('after showCaptureWindow')
  await sleep(1200)
  const capture = getCaptureWindow()
  log(`capture window visible=${capture?.isVisible()}`)
  if (capture) {
    const img = await withTimeout(capture.webContents.capturePage(), 5000, 'capture quick-window')
    if (img) {
      writeFileSync(join(shotDir, 'capture.png'), img.toPNG())
      log('shot capture')
    }

    await withTimeout(
      capture.webContents.executeJavaScript(`window.capture.submit('冒烟测试：来自快速捕获')`),
      5000,
      'submit via capture'
    )
    await sleep(600)
    log(`capture hidden after submit=${!capture.isVisible()}`)

    // 主窗口回到收件箱，验证跨窗口数据同步
    await withTimeout(
      Promise.resolve(main?.webContents.executeJavaScript(`document.querySelectorAll('nav button')[0].click()`)),
      5000,
      'switch to inbox'
    )
    await sleep(600)
    const rowCount = await withTimeout(
      Promise.resolve(main?.webContents.executeJavaScript(
        `document.querySelectorAll('main [role="button"]').length`
      )),
      5000,
      'count rows'
    )
    log(`inbox rows=${rowCount}, stored=${db.listTodos().length}`)
  }

  await sleep(200)
  log('done')
  appState.quitting = true
  app.exit(0)
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
    }

    // 1. 本地数据库
    initDatabase(join(app.getPath('userData'), 'todo.db'))

    // 2. IPC
    registerIpcHandlers()

    // 3. 系统托盘
    createTray()

    // 4. 全局快速捕获
    const registered = globalShortcut.register(CAPTURE_SHORTCUT, () => {
      showCaptureWindow()
    })
    if (!registered) {
      console.warn(`[TodoTracker] 全局快捷键注册失败: ${CAPTURE_SHORTCUT}`)
    }

    // 5. 主窗口（开机自启时静默到托盘）
    const startHidden = process.argv.includes('--startup')
    if (!startHidden) {
      createMainWindow()
    } else {
      createMainWindow()?.hide()
    }

    // 6. 冒烟测试：--smoke 启动时自动截图并退出（仅开发验证用）
    if (process.argv.includes('--smoke')) {
      void runSmokeTest()
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
    globalShortcut.unregisterAll()
  })
}
