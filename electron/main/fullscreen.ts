import { spawn, type ChildProcess } from 'node:child_process'

/**
 * 全屏程序检测（仅 Windows）
 *
 * 目的：玩游戏 / 看全屏视频时临时屏蔽全局快捷键，避免误触。
 * 为什么用 PowerShell：Electron 只能拿到自己进程内窗口的几何信息，
 * 想知道"别人家的全屏窗口"必须调 Win32 API，而项目不引入原生模块
 * （无 MSVC，无法本地编译；也不给打包增加 .node 复杂度）。
 * 因此起一个隐藏的 PowerShell 常驻子进程轮询前台窗口：
 *   前台窗口可见、不是桌面/任务栏，且矩形覆盖所在显示器的完整区域 → 视为全屏。
 *
 * 可靠性取舍：全程 fail-open —— 检测进程起不来、报错、超时，都当作"非全屏"，
 * 快捷键保持可用，绝不会因为检测失败把功能弄丢。
 */

const POLL_MS = 1500
const MAX_RESTARTS = 3
const RESTART_DELAY_MS = 60_000

const isWindows = process.platform === 'win32'

/**
 * 只输出 0/1，且状态变化时才打印。
 * Write-Output 后显式 Flush，否则 Node 侧要等缓冲区满才收到（会导致屏蔽延迟）。
 */
const SCRIPT = `
$ErrorActionPreference = 'SilentlyContinue'
$src = @'
using System;
using System.Runtime.InteropServices;
using System.Text;
public struct RECT { public int Left; public int Top; public int Right; public int Bottom; }
public struct MONITORINFO { public int cbSize; public RECT rcMonitor; public RECT rcWork; public uint dwFlags; }
public class FgWatcher {
  [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr hWnd, out RECT lpRect);
  [DllImport("user32.dll")] public static extern IntPtr MonitorFromWindow(IntPtr hWnd, uint dwFlags);
  [DllImport("user32.dll")] public static extern bool GetMonitorInfo(IntPtr hMonitor, ref MONITORINFO lpmi);
  [DllImport("user32.dll", CharSet = CharSet.Auto)] public static extern int GetClassName(IntPtr hWnd, StringBuilder lpClassName, int nMaxCount);
  [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr hWnd);
}
'@
Add-Type -TypeDefinition $src
if (-not ('FgWatcher' -as [type])) { exit 1 }

$desktopClasses = @('Progman', 'WorkerW', 'Shell_TrayWnd', 'Shell_SecondaryTrayWnd', 'Windows.UI.Core.CoreWindow')
$last = -1
while ($true) {
  $full = 0
  $h = [FgWatcher]::GetForegroundWindow()
  if ($h -ne [IntPtr]::Zero -and [FgWatcher]::IsWindowVisible($h)) {
    $sb = New-Object System.Text.StringBuilder 256
    [void][FgWatcher]::GetClassName($h, $sb, 256)
    if ($desktopClasses -notcontains $sb.ToString()) {
      $r = New-Object RECT
      if ([FgWatcher]::GetWindowRect($h, [ref]$r)) {
        $mi = New-Object MONITORINFO
        $mi.cbSize = [System.Runtime.InteropServices.Marshal]::SizeOf([type][MONITORINFO])
        if ([FgWatcher]::GetMonitorInfo([FgWatcher]::MonitorFromWindow($h, 2), [ref]$mi)) {
          if ($r.Left -le $mi.rcMonitor.Left -and $r.Top -le $mi.rcMonitor.Top -and
              $r.Right -ge $mi.rcMonitor.Right -and $r.Bottom -ge $mi.rcMonitor.Bottom) { $full = 1 }
        }
      }
    }
  }
  if ($full -ne $last) {
    $last = $full
    Write-Output $full
    [Console]::Out.Flush()
  }
  Start-Sleep -Milliseconds ${POLL_MS}
}
`

let child: ChildProcess | null = null
let fullscreen = false
let restarts = 0
let restartTimer: NodeJS.Timeout | null = null
let disposed = false
let notify: ((fullscreen: boolean) => void) | null = null

function setFullscreen(next: boolean): void {
  if (fullscreen === next) return
  fullscreen = next
  notify?.(fullscreen)
}

function start(onChange: (fullscreen: boolean) => void): void {
  if (child || disposed) return
  notify = onChange
  try {
    child = spawn(
      'powershell.exe',
      [
        '-NoProfile',
        '-NonInteractive',
        '-ExecutionPolicy',
        'Bypass',
        '-WindowStyle',
        'Hidden',
        '-Command',
        SCRIPT
      ],
      { windowsHide: true, stdio: ['ignore', 'pipe', 'ignore'] }
    )
  } catch (err) {
    console.warn('[TodoTracker] 全屏检测启动失败（快捷键屏蔽功能不可用）:', err)
    child = null
    return
  }

  let buffer = ''
  child.stdout?.setEncoding('utf-8')
  child.stdout?.on('data', (chunk: string) => {
    buffer += chunk
    const lines = buffer.split(/\r?\n/)
    buffer = lines.pop() ?? ''
    for (const line of lines) {
      const v = line.trim()
      if (v === '1') setFullscreen(true)
      else if (v === '0') setFullscreen(false)
    }
  })
  child.on('error', (err) => {
    console.warn('[TodoTracker] 全屏检测进程异常:', err)
  })
  child.on('exit', (code) => {
    child = null
    setFullscreen(false)
    if (disposed) return
    if (restarts >= MAX_RESTARTS) {
      console.warn('[TodoTracker] 全屏检测多次失败，已停用（快捷键不再自动屏蔽）')
      return
    }
    restarts += 1
    console.warn(`[TodoTracker] 全屏检测进程退出（code=${code}），${RESTART_DELAY_MS / 1000}s 后重试`)
    restartTimer = setTimeout(() => {
      restartTimer = null
      if (notify) start(notify)
    }, RESTART_DELAY_MS)
  })
}

/** 开始监听全屏状态（重复调用无副作用）；非 Windows 平台直接跳过 */
export function startFullscreenWatch(onChange: (fullscreen: boolean) => void): void {
  if (!isWindows) return
  notify = onChange
  if (restartTimer) {
    clearTimeout(restartTimer)
    restartTimer = null
  }
  restarts = 0
  start(onChange)
}

export function stopFullscreenWatch(): void {
  if (restartTimer) {
    clearTimeout(restartTimer)
    restartTimer = null
  }
  const c = child
  child = null
  setFullscreen(false)
  if (!c) return
  try {
    c.kill()
  } catch {
    /* 进程可能已退出 */
  }
}

export function isFullscreenActive(): boolean {
  return fullscreen
}

/** 退出前调用：停掉子进程并禁止重启 */
export function disposeFullscreenWatch(): void {
  disposed = true
  notify = null
  stopFullscreenWatch()
}
