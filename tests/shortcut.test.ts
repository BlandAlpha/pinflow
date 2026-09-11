import { beforeEach, describe, expect, it, vi } from 'vitest'
import { CAPTURE_SHORTCUT_ACCELERATOR } from '@shared/platform'
import type { AppPrefs } from '@shared/types'

/**
 * 用例覆盖全局快速捕获快捷键的两个开关：
 * 1. 关掉快捷键 → 必须真的注销（而不是只写偏好）
 * 2. 前台是全屏程序 + 开着屏蔽 → 临时注销；退出全屏 → 自动恢复
 * 3. 关掉快捷键时不再跑全屏检测子进程
 */

let prefs: AppPrefs = {
  theme: 'system',
  activeSpaceId: null,
  captureShortcut: true,
  fullscreenGuard: true
}

const fsState = {
  active: false,
  stopped: 0,
  onChange: null as null | ((fullscreen: boolean) => void)
}

const registry = new Set<string>()
let trigger: (() => void) | null = null

vi.mock('electron', () => ({
  globalShortcut: {
    register: (accel: string, cb: () => void): boolean => {
      registry.add(accel)
      trigger = cb
      return true
    },
    unregister: (accel: string): void => {
      registry.delete(accel)
    },
    unregisterAll: (): void => {
      registry.clear()
    },
    isRegistered: (accel: string): boolean => registry.has(accel)
  }
}))

vi.mock('../electron/main/prefs', () => ({
  getPrefs: (): AppPrefs => prefs,
  setPrefs: (patch: Partial<AppPrefs>): AppPrefs => {
    prefs = { ...prefs, ...patch }
    return prefs
  }
}))

vi.mock('../electron/main/fullscreen', () => ({
  isFullscreenActive: (): boolean => fsState.active,
  startFullscreenWatch: (cb: (fullscreen: boolean) => void): void => {
    fsState.onChange = cb
  },
  stopFullscreenWatch: (): void => {
    fsState.stopped += 1
    fsState.onChange = null
  },
  disposeFullscreenWatch: (): void => {
    fsState.onChange = null
  }
}))

// 注册用的是跨平台 accelerator（CommandOrControl），不是展示文案
const ACCEL = CAPTURE_SHORTCUT_ACCELERATOR

async function load() {
  vi.resetModules()
  return await import('../electron/main/shortcut')
}

beforeEach(() => {
  prefs = {
    theme: 'system',
    activeSpaceId: null,
    captureShortcut: true,
    fullscreenGuard: true
  }
  fsState.active = false
  fsState.stopped = 0
  fsState.onChange = null
  registry.clear()
  trigger = null
})

describe('快速捕获快捷键', () => {
  it('默认（开关都开）注册快捷键，且快捷键能唤起捕获窗口', async () => {
    const { initShortcut, getShortcutState } = await load()
    let fired = 0
    initShortcut(() => {
      fired += 1
    })
    expect(registry.has(ACCEL)).toBe(true)
    expect(getShortcutState()).toEqual({
      enabled: true,
      registered: true,
      suspendedByFullscreen: false
    })
    trigger?.()
    expect(fired).toBe(1)
  })

  it('停用快捷键后注销，并停掉全屏检测', async () => {
    const { initShortcut, setCaptureShortcutEnabled, getShortcutState } = await load()
    initShortcut(() => {})
    setCaptureShortcutEnabled(false)
    expect(registry.has(ACCEL)).toBe(false)
    expect(fsState.stopped).toBeGreaterThan(0)
    expect(getShortcutState().enabled).toBe(false)
  })

  it('全屏程序时临时屏蔽，退出全屏后自动恢复', async () => {
    const { initShortcut, getShortcutState } = await load()
    initShortcut(() => {})
    expect(registry.has(ACCEL)).toBe(true)

    fsState.active = true
    fsState.onChange?.(true)
    expect(registry.has(ACCEL)).toBe(false)
    expect(getShortcutState().suspendedByFullscreen).toBe(true)

    fsState.active = false
    fsState.onChange?.(false)
    expect(registry.has(ACCEL)).toBe(true)
  })

  it('关掉「全屏时屏蔽」开关后，全屏也不再屏蔽', async () => {
    const { initShortcut, setFullscreenGuardEnabled } = await load()
    initShortcut(() => {})
    setFullscreenGuardEnabled(false)
    expect(fsState.stopped).toBeGreaterThan(0)
    fsState.active = true
    expect(registry.has(ACCEL)).toBe(true)
  })

  it('退出前释放快捷键', async () => {
    const { initShortcut, disposeShortcut } = await load()
    initShortcut(() => {})
    disposeShortcut()
    expect(registry.has(ACCEL)).toBe(false)
  })
})
