import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * 回归用例：开机自启的读写
 * 1. Electron 的 getLoginItemSettings 会用 args 做比对，写入带 --startup 时，
 *    不带 args 读会返回 false（曾导致"勾上再打开又不勾"）。
 * 2. Windows 上 electron-auto-launch 需要管理员（写 HKLM），失败时必须回退到原生接口。
 * 3. 开发态不能用库：库只写 electron.exe 而不带应用目录，开机会弹 Electron 欢迎页。
 */

type NativeState = { openAtLogin: boolean; args: string[] }

let native: NativeState = { openAtLogin: false, args: [] }
let lib = { enabled: false, fail: true, calls: 0 }
let packaged = true

const APP_PATH = 'C:\\proj\\todo-tracker'
const STARTUP_ARGS = ['--startup']

function sameArgs(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((v, i) => v === b[i])
}

vi.mock('electron', () => ({
  app: {
    getName: () => 'todo-tracker',
    getPath: () => 'C:\\proj\\todo-tracker.exe',
    getAppPath: () => APP_PATH,
    get isPackaged() {
      return packaged
    },
    // 复刻 Electron 行为：args 与注册表里的命令不一致时判为未启用
    getLoginItemSettings: (opts?: { args?: string[] }) => ({
      openAtLogin: native.openAtLogin && sameArgs(opts?.args ?? [], native.args)
    }),
    setLoginItemSettings: (s: { openAtLogin: boolean; args?: string[] }) => {
      native = { openAtLogin: s.openAtLogin, args: s.args ?? [] }
    }
  }
}))

vi.mock('electron-auto-launch', () => ({
  __esModule: true,
  default: class {
    constructor(public opts: unknown) {}
    private guard(): void {
      lib.calls += 1
      if (lib.fail) throw new Error('EPERM')
    }
    async enable(): Promise<void> {
      this.guard()
      lib.enabled = true
    }
    async disable(): Promise<void> {
      this.guard()
      lib.enabled = false
    }
    async isEnabled(): Promise<boolean> {
      this.guard()
      return lib.enabled
    }
  }
}))

async function load() {
  vi.resetModules()
  return await import('../electron/main/autolaunch')
}

/**
 * 模块在顶层读 process.platform 决定走哪条实现，所以必须在 import 之前改。
 * 默认按 Windows 跑（历史用例都是 Windows 语义），macOS 分支单列一组。
 */
function setPlatform(p: NodeJS.Platform): void {
  Object.defineProperty(process, 'platform', { value: p, configurable: true })
}

beforeEach(() => {
  native = { openAtLogin: false, args: [] }
  lib = { enabled: false, fail: true, calls: 0 }
  packaged = true
  setPlatform('win32')
})

describe('autolaunch（安装版）', () => {
  it('库不可用时回退原生接口，且回读为已启用（args 必须一致）', async () => {
    const { setAutoLaunch, getAutoLaunch } = await load()
    expect(await setAutoLaunch(true)).toBe(true)
    expect(native).toEqual({ openAtLogin: true, args: STARTUP_ARGS })
    expect(await getAutoLaunch()).toBe(true)
  })

  it('关闭时清理原生项，回读为未启用', async () => {
    const { setAutoLaunch, getAutoLaunch } = await load()
    await setAutoLaunch(true)
    expect(await setAutoLaunch(false)).toBe(false)
    expect(native.openAtLogin).toBe(false)
    expect(await getAutoLaunch()).toBe(false)
  })

  it('库写入成功时清掉原生项，避免登录被启动两次', async () => {
    lib.fail = false
    const { setAutoLaunch, getAutoLaunch } = await load()
    native = { openAtLogin: true, args: STARTUP_ARGS }
    expect(await setAutoLaunch(true)).toBe(true)
    expect(native.openAtLogin).toBe(false)
    expect(lib.enabled).toBe(true)
    expect(await getAutoLaunch()).toBe(true)
  })
})

describe('autolaunch（开发态）', () => {
  it('不使用库，并把应用目录写进 args（否则开机会弹 Electron 欢迎页）', async () => {
    packaged = false
    const { setAutoLaunch, getAutoLaunch } = await load()
    expect(await setAutoLaunch(true)).toBe(true)
    expect(lib.calls).toBe(0)
    expect(native).toEqual({ openAtLogin: true, args: [APP_PATH, '--startup'] })
    expect(await getAutoLaunch()).toBe(true)
  })
})

describe('autolaunch（macOS）', () => {
  it('走原生登录项：不碰 electron-auto-launch，也不带 args（改的是系统登录项）', async () => {
    setPlatform('darwin')
    const { setAutoLaunch, getAutoLaunch } = await load()
    expect(await setAutoLaunch(true)).toBe(true)
    expect(lib.calls).toBe(0)
    expect(native).toEqual({ openAtLogin: true, args: [] })
    expect(await getAutoLaunch()).toBe(true)
    expect(await setAutoLaunch(false)).toBe(false)
  })

  it('开发态直接拒绝：登录项会指向 node_modules 里的 Electron.app，没有意义', async () => {
    setPlatform('darwin')
    packaged = false
    const { setAutoLaunch } = await load()
    expect(await setAutoLaunch(true)).toBe(false)
    expect(native.openAtLogin).toBe(false)
    expect(lib.calls).toBe(0)
  })
})
