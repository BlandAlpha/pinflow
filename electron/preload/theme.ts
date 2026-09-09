import { ipcRenderer } from 'electron'
import type { ThemeMode } from '@shared/types'

export interface ThemeSnapshot {
  mode: ThemeMode
  resolved: 'light' | 'dark'
}

/**
 * 在首帧前同步应用主题，避免明暗切换闪屏。
 * 同时监听主进程主题变更（系统主题变化 / 用户切换）。
 */
export function installThemeBootstrap(): ThemeSnapshot {
  let snapshot: ThemeSnapshot = { mode: 'system', resolved: 'dark' }
  try {
    snapshot = ipcRenderer.sendSync('app:theme:sync') as ThemeSnapshot
  } catch {
    /* 兜底默认深色 */
  }

  const apply = (resolved: 'light' | 'dark') => {
    const root = document.documentElement
    root.classList.toggle('dark', resolved === 'dark')
    root.style.colorScheme = resolved
  }

  if (document.documentElement) apply(snapshot.resolved)
  else document.addEventListener('DOMContentLoaded', () => apply(snapshot.resolved))

  ipcRenderer.on('app:theme:changed', (_e, next: ThemeSnapshot) => apply(next.resolved))

  return snapshot
}
