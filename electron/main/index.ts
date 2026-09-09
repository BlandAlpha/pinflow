import { join } from 'node:path'
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { app, globalShortcut, nativeTheme } from 'electron'
import { initDatabase } from './db'
import { broadcastTheme, registerIpcHandlers } from './ipc'
import { applyTheme, getPrefs, initPrefs, setTheme } from './prefs'
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
  let timer: NodeJS.Timeout | undefined
  const timeout = new Promise<null>((resolve) => {
    timer = setTimeout(() => {
      console.warn(`[smoke] ${label} 超时`)
      resolve(null)
    }, ms)
  })
  return Promise.race([
    p
      .catch((err) => {
        console.warn(`[smoke] ${label} 失败:`, err)
        return null
      })
      .finally(() => timer && clearTimeout(timer)),
    timeout
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
  // 示例数据：覆盖「未分类 / 已分类 / 有截止 / 有步骤 / 已逾期」几种状态
  // 已有数据时跳过，便于同一份数据分别跑深色/浅色截图
  if (db.listTodos().length === 0) {
  const q1 = db.createTodo({ title: '整理季度评审材料' })
  db.setQuadrant(q1.id, 1)

  const q2 = db.createTodo({ title: '重构订单导入脚本' })
  db.setQuadrant(q2.id, 2)

  const due = db.createTodo({
    title: '准备 CRM 会议',
    dueAt: new Date(Date.now() + 3 * 3600 * 1000).toISOString()
  })
  db.setQuadrant(due.id, 3)

  const overdue = db.createTodo({
    title: '补交上月费用报销',
    dueAt: new Date(Date.now() - 26 * 3600 * 1000).toISOString()
  })
  db.setQuadrant(overdue.id, 1)

  db.createTodo({ title: '看看有没有新的分析库' })
  db.createTodo({ title: '把工位上的线缆整理一下' })

  const withSteps = db.createTodo({ title: '发布新版本' })
  db.setQuadrant(withSteps.id, 2)
  db.addStep(withSteps.id, '更新版本号')
  db.addStep(withSteps.id, '打 tag')
  db.addStep(withSteps.id, '上传安装包')
  db.toggleStep((db.getTodo(withSteps.id).steps[0] ?? { id: '' }).id)
  log(`created todos, q1=${q1.id}`)
  } else {
    log('sample data already exists, skip seeding')
  }

  const main = getMainWindow()
  if (main) {
    // 可选：指定截图分辨率（--smoke-size=1280x720）与文件名后缀（--smoke-tag=hd）
    const sizeArg = process.argv.find((a) => a.startsWith('--smoke-size='))
    if (sizeArg) {
      const [w, h] = sizeArg
        .slice('--smoke-size='.length)
        .split('x')
        .map((n) => Number.parseInt(n, 10))
      if (w > 0 && h > 0) {
        if (main.isMaximized()) main.unmaximize()
        main.setSize(w, h)
        main.center()
        log(`window resized to ${w}x${h}`)
      }
    }
    // 刷新以载入新写入的示例数据（不 await，避免加载事件竞态阻塞）
    void main.webContents.reload()
    await sleep(2500)

    const nav = (index: number) =>
      withTimeout(
        main.webContents.executeJavaScript(
          `document.querySelectorAll('nav button')[${index}].click()`
        ),
        4000,
        `nav ${index}`
      )

    const tagArg = process.argv.find((a) => a.startsWith('--smoke-tag='))
    const tag = tagArg ? `-${tagArg.slice('--smoke-tag='.length)}` : ''
    const shot = async (name: string) => {
      const img = await withTimeout(main.webContents.capturePage(), 5000, `capture ${name}`)
      if (!img) return
      writeFileSync(join(shotDir, `${name}${tag}.png`), img.toPNG())
      log(`shot ${name}${tag}`)
    }

    // 可选：只截指定视图（--smoke-views=inbox,kanban）
    const viewsArg = process.argv.find((a) => a.startsWith('--smoke-views='))
    const wanted = viewsArg ? viewsArg.slice('--smoke-views='.length).split(',') : null

    for (const [index, name] of [
      [0, 'inbox'],
      [1, 'today'],
      [2, 'board'],
      [3, 'all']
    ] as const) {
      if (wanted && !wanted.includes(name)) continue
      await nav(index)
      await sleep(600)
      await shot(name)
    }

    // 打开详情面板（含 2D 优先级选择器）
    if (!wanted || wanted.includes('detail')) {
      await nav(0)
      await sleep(400)
      await withTimeout(
        main.webContents.executeJavaScript(`document.querySelector('main .task-card')?.click()`),
        4000,
        'open detail'
      )
      await sleep(700)
      await shot('detail')
    }

    // 侧栏三档响应式状态（完整 / 紧凑 / 仅图标）
    if (!wanted || wanted.includes('sidebar')) {
      await nav(0)
      await sleep(300)
      const original = main.getSize()
      for (const [w, h, name] of [
        [1440, 900, 'sidebar-full'],
        [1120, 860, 'sidebar-compact'],
        [960, 820, 'sidebar-icon']
      ] as const) {
        if (main.isMaximized()) main.unmaximize()
        main.setSize(w, h)
        main.center()
        await sleep(500)
        await shot(name)
      }
      main.setSize(original[0], original[1])
      main.center()
      await sleep(300)
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
