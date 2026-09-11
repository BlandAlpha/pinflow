import { app } from 'electron'
import AutoLaunch from 'electron-auto-launch'

/**
 * 开机自启（跨平台）
 *
 * - 打包后：macOS / Linux 用 electron-auto-launch（登录项 / XDG autostart 的 .desktop）；
 *   Windows 先试该库，写不动再退回 Electron 原生接口 —— 该库在 64 位 Windows 上写
 *   HKLM\Software\Wow6432Node\...\Run（需要管理员），普通权限下必然失败，
 *   而 app.setLoginItemSettings 写 HKCU，免管理员。
 * - 开发态（!app.isPackaged）：不用库。库只写 process.execPath（node_modules 里的
 *   electron.exe）且不带应用目录，开机启动会直接弹出 Electron 的默认欢迎页。
 *   这时改用原生接口并把应用目录填进 args。
 *
 * 原生接口的读法有坑：getLoginItemSettings 用传入的 args 与注册表里的命令比对，
 * 不带 args 读会判定不匹配返回 false（曾表现为"勾上了，重开设置又不勾"）。
 * 读取必须带与写入完全相同的 args。
 */

const isWindows = process.platform === 'win32'

/** 开机自启启动本应用时的命令行参数：主窗口静默到托盘 */
function startupArgs(): string[] {
  // 开发态必须带上应用目录，否则 electron.exe 不知道要跑哪个 app
  return app.isPackaged ? ['--startup'] : [app.getAppPath(), '--startup']
}

/** 是否使用 electron-auto-launch（开发态一律不用，见文件头说明） */
function useLibrary(): boolean {
  return app.isPackaged
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

/** 原生接口读取：当前 args 与历史无参项都查一遍 */
function nativeRead(): boolean {
  return (
    app.getLoginItemSettings({ args: startupArgs() }).openAtLogin ||
    app.getLoginItemSettings().openAtLogin
  )
}

function nativeWrite(enabled: boolean): void {
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
    // 开发态兜底：macOS 生效，Linux 上 Electron 不支持（仅影响开发调试）
    app.setLoginItemSettings({ openAtLogin: enabled })
  }

  return await getAutoLaunch()
}
