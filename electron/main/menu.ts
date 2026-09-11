import { Menu, app } from 'electron'
import type { MenuItemConstructorOptions } from 'electron'

/**
 * macOS 应用菜单（屏幕顶部那条）。
 *
 * 为什么要自己做：Electron 的默认菜单第一项叫 "Electron"，且带一堆开发项。
 * 更关键的是 **Edit 菜单必须存在** —— macOS 上的 ⌘C / ⌘V / ⌘A / ⌘Z 是由菜单
 * role 触发的，删掉菜单就等于删掉这些快捷键（Windows 不受影响：无边框窗口
 * 根本不显示菜单栏，剪贴板快捷键由 Chromium 自己处理）。
 *
 * 只用内置 role，不写任何自定义行为：App / Edit / Window 三组覆盖 mac 用户的肌肉记忆
 * （⌘Q 退出、⌘W 关窗、⌘M 最小化、⌘, 偏好设置等）。
 */
export function installAppMenu(): void {
  if (process.platform !== 'darwin') return
  const template: MenuItemConstructorOptions[] = [
    { role: 'appMenu' },
    { role: 'editMenu' },
    { role: 'windowMenu' }
  ]
  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}

/** 关于面板里的应用信息（macOS 的「关于」对话框会读这些） */
export function setAboutPanel(): void {
  if (process.platform !== 'darwin') return
  app.setAboutPanelOptions({
    applicationName: app.getName(),
    applicationVersion: app.getVersion(),
    copyright: '本地优先的 Todo 管理器'
  })
}
