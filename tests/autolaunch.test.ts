import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * 回归用例：开机自启的读写
 * 1. Electron 的 getLoginItemSettings 会用 args 做比对，写入带 --startup 时，
 *    不带 args 读会返回 false（曾导致"勾上再打开又不勾"）。
 * 2. Windows 上 electron-auto-launch 需要管理员（写 HKLM），失败时必须回退到原生接口。
 */

type NativeState = { openAtLogin: boolean; args: string[] }

let native: NativeState = { openAtLogin: false, args: [] }
let lib = { enabled: false, fail: true }

function sameArgs(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((v, i) => v === b[i])
}

vi.mock('electron', () => ({
  app: {
    getName: () => 'todo-tracker',
    getPath: () => 'C:\\tmp\\todo-tracker.exe',
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

beforeEach(() => {
  native = { openAtLogin: false, args: [] }
  lib = { enabled: false, fail: true }
})

describe('autolaunch', () => {
  it('库不可用时回退原生接口，且回读为已启用（args 必须一致）', async () => {
    const { setAutoLaunch, getAutoLaunch } = await load()
    expect(await setAutoLaunch(true)).toBe(true)
    expect(native).toEqual({ openAtLogin: true, args: ['--startup'] })
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
    const { setAutoLaunch } = await load()
    native = { openAtLogin: true, args: ['--startup'] }
    expect(await setAutoLaunch(true)).toBe(true)
    expect(native.openAtLogin).toBe(false)
  })
})
