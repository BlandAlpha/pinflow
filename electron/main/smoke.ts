/**
 * 开发用的自动化冒烟测试。
 *
 * 之所以独立成文件：它由 index.ts 动态 import，且只在未打包时加载。
 * 这段逻辑会往 app.getAppPath()/.smoke 写截图，而打包后 app.getAppPath()
 * 指向 asar 内部（只读），在生产环境加载必然抛错。
 *
 * 用法见 README「冒烟测试可选参数」。
 */
import { join } from 'node:path'
import { mkdirSync, writeFileSync } from 'node:fs'
import { app, globalShortcut } from 'electron'
import * as db from './db'
import { appState } from './state'
import { getCaptureWindow, getMainWindow, showCaptureWindow } from './windows'

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

/**
 * 白板交互校验脚本（在渲染进程里跑）：
 * 1) 拖动卡片 -> 坐标写回数据；2) 滚轮以光标为锚缩放；3) 拖空白平移；4) 空间切换。
 */
const BOARD_INTERACTION_SCRIPT = `(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
  const out = {}
  const fire = (el, type, x, y, extra) =>
    el.dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, clientX: x, clientY: y, button: 0, pointerId: 1, ...(extra || {}) }))

  // 1. 拖动卡片
  const card = document.querySelector('[data-board-card]')
  if (!card) return { ok: false, reason: 'no card' }
  const id = card.getAttribute('data-board-card')
  const before = { left: card.style.left, top: card.style.top }
  const r = card.getBoundingClientRect()
  const cx = r.left + r.width / 2
  const cy = r.top + r.height / 2
  fire(card, 'pointerdown', cx, cy)
  window.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, clientX: cx + 170, clientY: cy + 110, pointerId: 1 }))
  window.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, clientX: cx + 170, clientY: cy + 110, pointerId: 1 }))
  await sleep(700)
  const after = document.querySelector('[data-board-card="' + id + '"]')
  out.drag = {
    before,
    after: after ? { left: after.style.left, top: after.style.top } : null,
    moved: !!after && (after.style.left !== before.left || after.style.top !== before.top)
  }

  // 2. 滚轮缩放（锚点在光标处）
  const vp = document.querySelector('[data-board-viewport]')
  const stage = document.querySelector('[data-board-stage]')
  const zoomLabel = () => document.querySelector('[data-zoom-label]')?.textContent?.trim()
  const zoomBefore = zoomLabel()
  const vr = vp.getBoundingClientRect()
  vp.dispatchEvent(new WheelEvent('wheel', {
    bubbles: true, cancelable: true, deltaY: -300,
    clientX: vr.left + vr.width * 0.75, clientY: vr.top + vr.height * 0.3
  }))
  await sleep(500)
  out.zoom = {
    before: zoomBefore,
    after: zoomLabel(),
    transform: stage?.style.transform || null
  }

  // 3. 拖空白平移
  const tBefore = stage?.style.transform
  fire(vp, 'pointerdown', vr.left + 12, vr.top + 12)
  window.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, clientX: vr.left + 120, clientY: vr.top + 80, pointerId: 1 }))
  window.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, clientX: vr.left + 120, clientY: vr.top + 80, pointerId: 1 }))
  await sleep(300)
  out.pan = { before: tBefore, after: stage?.style.transform || null, changed: tBefore !== stage?.style.transform }

  // 4. 空间切换
  const sw = document.querySelector('[aria-label^="空间"]')
  if (sw) {
    const sr = sw.getBoundingClientRect()
    fire(sw, 'pointerdown', sr.left + sr.width / 2, sr.top + sr.height / 2)
    fire(sw, 'pointerup', sr.left + sr.width / 2, sr.top + sr.height / 2)
    sw.click()
    await sleep(400)
    out.spaces = {
      trigger: sw.textContent?.trim().slice(0, 12),
      menuItems: document.querySelectorAll('[role="menuitem"]').length
    }
    document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await sleep(200)
  }
  // 5. 设置里的空间管理（先关掉空间菜单，免得挡住点击）
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
  await sleep(300)
  const settingsBtn =
    document.querySelector('[aria-label="设置"]') ||
    Array.from(document.querySelectorAll('button')).find((b) => b.textContent?.trim() === '设置')
  settingsBtn?.click()
  await sleep(600)
  const dialog = document.querySelector('[role="dialog"]')
  out.settings = {
    foundButton: !!settingsBtn,
    opened: !!dialog,
    hasSpaceSection: !!dialog && dialog.textContent.includes('空间'),
    spaceRows: dialog ? dialog.querySelectorAll('input').length : 0
  }
  out.ok = true
  return out
})()`

/** 开发用：启动后自动写入示例数据、对各窗口截图、验证全局快捷键，然后退出 */
export async function runSmokeTest(captureShortcut: string): Promise<void> {
  const log = (msg: string) => console.log(`[smoke] ${msg}`)
  const shotDir = join(app.getAppPath(), '.smoke')
  mkdirSync(shotDir, { recursive: true })

  // 冒烟测试使用独立数据目录，避免污染日常数据
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

    // 侧栏两档响应式状态（完整 / 仅图标）
    if (!wanted || wanted.includes('sidebar')) {
      await nav(0)
      await sleep(300)
      const original = main.getSize()
      for (const [w, h, name] of [
        [1440, 900, 'sidebar-full'],
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

    // 交互校验：白板拖拽 / 光标锚定缩放 / 空间切换（--smoke-interact）
    if (process.argv.includes('--smoke-interact')) {
      await nav(2) // 白板
      await sleep(600)
      const result = await withTimeout(
        main.webContents.executeJavaScript(BOARD_INTERACTION_SCRIPT),
        15000,
        'board interaction'
      )
      log(`interact=${JSON.stringify(result)}`)
      writeFileSync(join(shotDir, 'interact.json'), JSON.stringify(result, null, 2))
      await shot('settings-spaces')
    }

    const shortcutOk = globalShortcut.isRegistered(captureShortcut)
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
      Promise.resolve(
        main?.webContents.executeJavaScript(`document.querySelectorAll('nav button')[0].click()`)
      ),
      5000,
      'switch to inbox'
    )
    await sleep(600)
    const rowCount = await withTimeout(
      Promise.resolve(
        main?.webContents.executeJavaScript(
          `document.querySelectorAll('main [role="button"]').length`
        )
      ),
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
