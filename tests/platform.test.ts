import { describe, expect, it } from 'vitest'
import { CAPTURE_SHORTCUT_ACCELERATOR, captureShortcutLabel, isMac } from '@shared/platform'

/**
 * 平台适配的回归用例：
 * 注册用的 accelerator 与展示给用户的文案是两套东西，必须分开 ——
 * 早先注册与文案都用 'Ctrl+Shift+Space'，在 macOS 上既敲不出 Ctrl，也显示不对。
 */
describe('平台文案与快捷键', () => {
  it('accelerator 用 CommandOrControl，由 Electron 落到各平台的修饰键', () => {
    expect(CAPTURE_SHORTCUT_ACCELERATOR).toBe('CommandOrControl+Shift+Space')
  })

  it('展示文案跟着平台走：macOS 用符号写法', () => {
    expect(captureShortcutLabel('darwin')).toBe('⌘⇧Space')
    expect(captureShortcutLabel('win32')).toBe('Ctrl+Shift+Space')
    expect(captureShortcutLabel('linux')).toBe('Ctrl+Shift+Space')
  })

  it('isMac 只认 darwin', () => {
    expect(isMac('darwin')).toBe(true)
    expect(isMac('win32')).toBe(false)
    expect(isMac('linux')).toBe(false)
  })
})
