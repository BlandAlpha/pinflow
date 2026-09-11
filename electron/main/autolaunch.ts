import { app } from 'electron'
import AutoLaunch from 'electron-auto-launch'

/**
 * 开机自启（跨平台）
 *
 * - macOS：一律用 Electron 原生接口。electron-auto-launch 在 mac 上是通过
 *   AppleScript 把「.app 里的可执行文件」加进登录项，而不是 .app 包本身，
 *   重启后系统还原不出应用；原生接口注册的是应用包，随包升级/移动也不会留死项。
 * - Windows：打包后先试 electron-auto-launch，写不动再退回原生接口 —— 该库在
 *   64 位 Windows 上写 HKLM\Software\Wow6432Node\...\Run（需要管理员），普通权限下
 *   必然失败，而 app.setLoginItemSettings 写 HKCU，免管理员。
 * - 开发态（!app.isPackaged）：Windows / Linux 不用库。库只写 process.execPath
 *   （node_modules 里的 electron.exe）且不带应用目录，开机启动会直接弹出 Electron
 *   的默认欢迎页；这时改用原生接口并把应用目录填进 args。
 *
 * 原生接口的读法有坑（Windows）：getLoginItemSettings 用传入的 args 与注册表里的
 * 命令比对，不带 args 读会判定不匹配返回 false（曾表现为"勾上了，重开设置又不勾"）。
 * 读取必须带与写入完全相同的 args。macOS 走的是系统登录项，不涉及 args。
 *
 * 已知平台差异：macOS 13+ 的登录项由系统 SMAppService 管理，无法携带命令行参数，
 * 因此登录启动会正常打开主窗口（不会静默到托盘）—— 这也是 mac 上菜单栏应用的常见做法。
 */

const isWindows = process.platform === 'win32'
const isMac = process.platform === 'darwin'

/** 开机自启启动本应用时的命令行参数：主窗口静默到托盘 */
function startupArgs(): string[] {
  // 开发态必须带上应用目录，否则 electron.exe 不知道要跑哪个 app
  return app.isPackaged ? ['--startup'] : [app.getAppPath(), '--startup']
}

/** 是否使用 electron-auto-launch（macOS 与开发态一律不用，见文件头说明） */
function useLibrary(): boolean {
  return app.isPackaged && !isMac
}

let launcher: AutoLaunch | null = null

function autoLauncher(): AutoLaunch {
  if (!launcher) {
    launcher = new AutoLaunch({
      name: app.getName(),
      path: app.getPath('exe'),
      // 开机自启时静默启动（mac 写登录项 hidden 标记，win/linux 追加 --hidden）
      isHidden: true
    })
  }
  return launcher
}

/** 原生接口读取：macOS 走系统登录项（无 args），Windows 需要 args 精确比对 */
function nativeRead(): boolean {
  if (isMac) return app.getLoginItemSettings().openAtLogin
  return (
    app.getLoginItemSettings({ args: startupArgs() }).openAtLogin ||
    app.getLoginItemSettings().openAtLogin
  )
}

function nativeWrite(enabled: boolean): void {
  if (isMac) {
    app.setLoginItemSettings({ openAtLogin: enabled })
    return
  }
  app.setLoginItemSettings({ openAtLogin: enabled, args: startupArgs() })
}

export async function getAutoLaunch(): Promise<boolean> {
  if (useLibrary()) {
    try {
      if (await autoLauncher().isEnabled()) return true
    } catch (err) {
      console.warn('[TodoTracker] 读取开机自启状态失败:', err)
    }
  }
  return nativeRead()
}

export async function setAutoLaunch(enabled: boolean): Promise<boolean> {
  if (isMac) {
    // 开发态的「应用」是 node_modules 里的 Electron.app，写成登录项没有意义
    // （登录后会打开 Electron 默认页），直接以未开启回答，渲染层的复选框会自动回滚
    if (!app.isPackaged) return false
    nativeWrite(enabled)
    return nativeRead()
  }

  let libOk = false
  if (useLibrary()) {
    try {
      if (enabled) await autoLauncher().enable()
      else await autoLauncher().disable()
      libOk = true
    } catch (err) {
      console.warn(`[TodoTracker] 设置开机自启失败（${enabled ? '开启' : '关闭'}）:`, err)
    }
  }

  if (isWindows) {
    // 关闭时无条件清理原生项（库可能无权删 HKLM 里的项）；
    // 开启且库已写成功时也要清掉原生项，避免登录时被启动两次；
    // 库写不进去时才把原生项当作兜底。
    nativeWrite(enabled && !libOk)
  } else if (!libOk) {
    // 开发态兜底：Linux 上 Electron 不支持（仅影响开发调试）
    app.setLoginItemSettings({ openAtLogin: enabled })
  }

  return await getAutoLaunch()
}
