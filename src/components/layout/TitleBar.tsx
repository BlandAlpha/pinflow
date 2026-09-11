import { Minus, Square, X } from 'lucide-react'
import { useTodos } from '@/store/todos'
import { Button } from '@/components/ui/button'
import { AppIcon } from '@/components/layout/AppIcon'
import { cn } from '@/lib/utils'

const VIEW_TITLES: Record<string, string> = {
  inbox: '收件箱',
  today: '今天',
  board: '白板',
  all: '全部任务'
}

/** 主进程给 macOS 用的交通灯内边距是 { x: 14, y: 12 }，三个按钮 + 间距约 66px，留 78px 不打架 */
const isMac = window.api?.platform === 'darwin'

export function TitleBar() {
  const view = useTodos((s) => s.view)

  return (
    <header
      className={cn(
        'app-drag flex h-9 shrink-0 select-none items-center gap-2 border-b border-border bg-surface-2/60 pr-3',
        isMac ? 'pl-[78px]' : 'pl-3'
      )}
      // 双击标题栏缩放：macOS 的 hiddenInset 与自绘标题栏都会吃掉系统的默认行为，手动补上。
      // 落在按钮/可交互控件（app-no-drag）上时不算双击标题栏
      onDoubleClick={(e) => {
        if ((e.target as HTMLElement).closest('.app-no-drag')) return
        void window.api.toggleMaximizeWindow()
      }}
    >
      <AppIcon className="h-[15px] w-[15px]" />
      <span className="text-2xs font-medium tracking-wide text-foreground/70">Todo Tracker</span>
      <span className="text-2xs text-muted-foreground/60">/ {VIEW_TITLES[view]}</span>

      <div className="flex-1" />

      {/* macOS 用系统交通灯（主进程 titleBarStyle: hiddenInset），不再自绘窗口按钮 */}
      {!isMac && (
        <div className="app-no-drag flex items-center">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-9 rounded-none text-muted-foreground hover:bg-accent"
            title="最小化"
            onClick={() => void window.api.minimizeWindow()}
          >
            <Minus className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-9 rounded-none text-muted-foreground hover:bg-accent"
            title="最大化 / 还原"
            onClick={() => void window.api.toggleMaximizeWindow()}
          >
            <Square className="h-3 w-3" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-9 rounded-none text-muted-foreground hover:bg-destructive hover:text-destructive-foreground"
            title="隐藏到托盘"
            onClick={() => void window.api.closeWindow()}
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}
    </header>
  )
}
