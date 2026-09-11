import { captureShortcutLabel } from '@shared/platform'

/**
 * 快速捕获快捷键的展示文案（macOS 上是 ⌘⇧Space，其它平台 Ctrl+Shift+Space）。
 * 平台值由 preload 注入，这里只做一次换算，避免各处硬编码 Ctrl 字样。
 */
export const CAPTURE_SHORTCUT_LABEL = captureShortcutLabel(window.api?.platform ?? 'win32')
