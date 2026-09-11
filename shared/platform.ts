/**
 * 平台差异（纯逻辑，不读 process，主进程与渲染进程共用）
 *
 * 渲染进程拿不到 process.platform，平台值由 preload 同步注入（`window.api.platform`），
 * 再交给这里的小函数换算出「显示给用户的文案」。
 */

/** 与 Node 的 process.platform 对齐的取值（本项目只关心这三个） */
export type Platform = 'darwin' | 'win32' | 'linux'

/**
 * 全局快速捕获的 Electron accelerator。
 * 用 CommandOrControl 而非写死 Ctrl：macOS 上自动落到 ⌘，Windows / Linux 上仍是 Ctrl。
 */
export const CAPTURE_SHORTCUT_ACCELERATOR = 'CommandOrControl+Shift+Space'

/** 快捷键的用户可见文案：macOS 用符号写法，其余平台保持 Ctrl 全称 */
export function captureShortcutLabel(platform: Platform): string {
  return platform === 'darwin' ? '⌘⇧Space' : 'Ctrl+Shift+Space'
}

/** macOS 判定（渲染层传 window.api.platform，主进程传 process.platform） */
export function isMac(platform: Platform): boolean {
  return platform === 'darwin'
}
