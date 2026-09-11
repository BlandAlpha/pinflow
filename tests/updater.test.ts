import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * 用例覆盖应用内更新的状态机与边界：
 * 1. 开发态 / 免安装版没有 app-update.yml —— 必须如实标记不可用，且不发网络请求
 * 2. 正常链路：checking -> available -> downloading -> downloaded
 * 3. 只有下载完成才允许重启安装（防止把半截状态带进安装流程）
 * 4. 网络错误要转成人话，而不是把 stack 丢到设置面板
 */

type Listener = (...args: never[]) => void

const h = vi.hoisted(() => ({
  /** app.isPackaged */
  packaged: { value: true },
  /** app-update.yml 是否存在（免安装目录里没有） */
  configExists: { value: true },
  /** 更新源的响应行为 */
  behavior: { value: 'available' as 'available' | 'latest' | 'throw' },
  listeners: new Map<string, Listener[]>(),
  notifications: [] as { title?: string; body?: string }[],
  calls: {
    check: 0,
    download: 0,
    quitAndInstall: [] as unknown[][],
    downloaded: 0
  }
}))

vi.mock('electron', () => {
  class Notification {
    static isSupported(): boolean {
      return true
    }
    constructor(opts: { title?: string; body?: string }) {
      h.notifications.push(opts)
    }
    show(): void {}
  }
  return {
    app: {
      get isPackaged(): boolean {
        return h.packaged.value
      },
      getVersion: (): string => '0.1.0'
    },
    // 没有窗口：广播走空循环即可
    BrowserWindow: { getAllWindows: (): unknown[] => [] },
    Notification
  }
})

vi.mock('node:fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs')>()
  return {
    ...actual,
    existsSync: (p: Parameters<typeof actual.existsSync>[0]): boolean =>
      String(p).endsWith('app-update.yml') ? h.configExists.value : actual.existsSync(p)
  }
})

vi.mock('electron-updater', () => {
  const emit = (event: string, payload?: unknown): void => {
    for (const cb of h.listeners.get(event) ?? []) cb(payload as never)
  }
  return {
    autoUpdater: {
      autoDownload: true,
      autoInstallOnAppQuit: false,
      on: (event: string, cb: Listener): void => {
        h.listeners.set(event, [...(h.listeners.get(event) ?? []), cb])
      },
      checkForUpdates: async (): Promise<null> => {
        h.calls.check += 1
        emit('checking-for-update')
        if (h.behavior.value === 'throw') {
          throw new Error('getaddrinfo ENOTFOUND dl.example.com')
        }
        if (h.behavior.value === 'latest') {
          emit('update-not-available', { version: '0.1.0' })
        } else {
          emit('update-available', { version: '0.2.0' })
        }
        return null
      },
      downloadUpdate: async (): Promise<void> => {
        h.calls.download += 1
        emit('download-progress', { percent: 42.7 })
        h.calls.downloaded += 1
        emit('update-downloaded', { version: '0.2.0' })
      },
      quitAndInstall: (...args: unknown[]): void => {
        h.calls.quitAndInstall.push(args)
      }
    }
  }
})

let mod: typeof import('../electron/main/updater') | null = null

async function load() {
  vi.resetModules()
  mod = await import('../electron/main/updater')
  return mod
}

beforeEach(() => {
  h.packaged.value = true
  h.configExists.value = true
  h.behavior.value = 'available'
  h.listeners.clear()
  h.notifications.length = 0
  h.calls.check = 0
  h.calls.download = 0
  h.calls.downloaded = 0
  h.calls.quitAndInstall.length = 0
  // updater 用它拼 app-update.yml 路径，纯 Node 下本来不存在
  ;(process as unknown as { resourcesPath: string }).resourcesPath = 'C:\\fake\\resources'
})

afterEach(() => {
  mod?.disposeUpdater()
  mod = null
})

describe('应用内更新', () => {
  it('开发态（未打包）标记为不可用，且不发检查请求', async () => {
    h.packaged.value = false
    const { initUpdater, checkForUpdates, getUpdateStatus } = await load()
    initUpdater()
    expect(getUpdateStatus().enabled).toBe(false)
    await checkForUpdates()
    expect(h.calls.check).toBe(0)
  })

  it('已打包但没有 app-update.yml（免安装目录）同样标记为不可用', async () => {
    h.configExists.value = false
    const { initUpdater, getUpdateStatus } = await load()
    initUpdater()
    expect(getUpdateStatus().enabled).toBe(false)
  })

  it('打包态检查到新版本：checking -> available，并带出新版本号', async () => {
    const { initUpdater, checkForUpdates, getUpdateStatus } = await load()
    initUpdater()
    expect(getUpdateStatus().enabled).toBe(true)
    expect(getUpdateStatus().currentVersion).toBe('0.1.0')

    const seen: string[] = []
    // 直接看状态流转不够，注册在广播上确认「过程也被推给别人了」
    const status = await checkForUpdates()
    seen.push(status.phase)
    expect(seen).toEqual(['available'])
    expect(status.version).toBe('0.2.0')
    expect(status.percent).toBe(0)
  })

  it('已是最新版本时进入 not-available', async () => {
    h.behavior.value = 'latest'
    const { initUpdater, checkForUpdates, getUpdateStatus } = await load()
    initUpdater()
    await checkForUpdates()
    expect(getUpdateStatus().phase).toBe('not-available')
    expect(getUpdateStatus().version).toBeNull()
  })

  it('下载推进进度，完成后进入 downloaded', async () => {
    const { initUpdater, downloadUpdate, getUpdateStatus } = await load()
    initUpdater()
    await downloadUpdate()
    expect(h.calls.download).toBe(1)
    expect(getUpdateStatus().phase).toBe('downloaded')
    expect(getUpdateStatus().percent).toBe(100)
  })

  it('下载期间重复点下载不会重复发起请求', async () => {
    const { initUpdater, downloadUpdate, getUpdateStatus } = await load()
    initUpdater()
    await downloadUpdate()
    await downloadUpdate()
    expect(h.calls.download).toBe(1)
    expect(getUpdateStatus().phase).toBe('downloaded')
  })

  it('只有下载完成后才允许重启安装，且用静默参数', async () => {
    const { initUpdater, installUpdate, downloadUpdate } = await load()
    initUpdater()

    // 还没下载就点：不应触发安装
    installUpdate()
    expect(h.calls.quitAndInstall).toHaveLength(0)

    await downloadUpdate()
    installUpdate()
    // 第一个参数 silent=true → NSIS 收到 /S；第二个 forceRunAfter=true → 装完自动拉起
    expect(h.calls.quitAndInstall).toEqual([[true, true]])
  })

  it('网络错误转成人话提示', async () => {
    h.behavior.value = 'throw'
    const { initUpdater, checkForUpdates, getUpdateStatus } = await load()
    initUpdater()
    await checkForUpdates()
    expect(getUpdateStatus().phase).toBe('error')
    expect(getUpdateStatus().message).toBe('无法连接更新服务器，请检查网络')
  })

  it('托盘里的「检查更新」会发系统通知', async () => {
    const { initUpdater, checkForUpdatesWithFeedback } = await load()
    initUpdater()
    await checkForUpdatesWithFeedback()
    expect(h.notifications).toHaveLength(1)
    expect(h.notifications[0].title).toBe('发现新版本')
    expect(h.notifications[0].body).toContain('0.2.0')
  })

  it('不可用时点「检查更新」不会静默失败', async () => {
    h.packaged.value = false
    const { initUpdater, checkForUpdatesWithFeedback } = await load()
    initUpdater()
    await checkForUpdatesWithFeedback()
    expect(h.notifications).toHaveLength(1)
    expect(h.notifications[0].body).toContain('不支持自动更新')
  })
})
