import { app } from 'electron'
import AutoLaunch from 'electron-auto-launch'

/**
 * 开机自启（跨平台）
 *
 * - macOS / Linux：使用 electron-auto-launch（登录项 / XDG autostart 的 .desktop）。
 * - Windows：先试 electron-auto-launch，写不动再退回 Electron 原生接口。
 *   原因：electron-auto-launch 5.x 在 64 位 Windows 上写
 *   HKLM\Software\Wow6432Node\...\Run（需要管理员权限），普通权限下会直接失败；
 *   而 app.setLoginItemSettings 写 HKCU，免管理员，是更可靠的一条路。
 *
 * 另外注意原生接口的读法：getLoginItemSettings 默认用空 args 去比对注册表里的命令，
 * 而我们写入时带了 --startup，直接读会判定不匹配返回 false
 * （表现就是"勾上了，重新打开设置又不勾"）。读取必须带上同样的 args。
 */

/** 开机自启时传给本进程的参数：主窗口静默到托盘 */
export const STARTUP_ARGS = ['--startup']

const isWindows = process.platform === 'win32'

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

/** 原生接口读取（仅 Windows 用）：带 args 与不带 args 都查一遍，兼容历史遗留项 */
function nativeRead(): boolean {
  return (
    app.getLoginItemSettings({ args: STARTUP_ARGS }).openAtLogin ||
    app.getLoginItemSettings().openAtLogin
  )
}

function nativeWrite(enabled: boolean): void {
  app.setLoginItemSettings({ openAtLogin: enabled, args: STARTUP_ARGS })
}

export async function getAutoLaunch(): Promise<boolean> {
  let libEnabled = false
  try {
    libEnabled = await autoLauncher().isEnabled()
  } catch (err) {
    console.warn('[TodoTracker] 读取开机自启状态失败:', err)
  }
  if (isWindows) return libEnabled || nativeRead()
  return libEnabled
}

export async function setAutoLaunch(enabled: boolean): Promise<boolean> {
  let libOk = false
  try {
    if (enabled) await autoLauncher().enable()
    else await autoLauncher().disable()
    libOk = true
  } catch (err) {
    console.warn(`[TodoTracker] 设置开机自启失败（${enabled ? '开启' : '关闭'}）:`, err)
  }

  if (isWindows) {
    // 关闭时无条件清理原生项（库可能无权删 HKLM 里的项）；
    // 开启且库已写成功时也要清掉原生项，避免登录时被启动两次；
    // 只有库写不进去时，才把原生项当作兜底。
    nativeWrite(enabled && !libOk)
  }

  return await getAutoLaunch()
}
