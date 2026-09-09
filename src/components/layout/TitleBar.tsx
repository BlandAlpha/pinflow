import { CheckSquare, Minus, Square, X } from 'lucide-react'
import { useTodos } from '@/store/todos'
import { Button } from '@/components/ui/button'

const VIEW_TITLES: Record<string, string> = {
  inbox: '收件箱',
  today: '今天',
  matrix: '四象限',
  all: '全部任务'
}

export function TitleBar() {
  const view = useTodos((s) => s.view)

  return (
    <header className="app-drag flex h-9 shrink-0 select-none items-center gap-2 border-b border-border bg-card/60 px-3">
      <div className="flex items-center gap-1.5 text-primary">
        <CheckSquare className="h-3.5 w-3.5" />
        <span className="text-[12px] font-semibold tracking-wide">Todo Tracker</span>
      </div>
      <span className="text-[12px] text-muted-foreground">/ {VIEW_TITLES[view]}</span>

      <div className="flex-1" />

      <div className="app-no-drag flex items-center">
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-9 rounded-none hover:bg-secondary"
          title="最小化"
          onClick={() => void window.api.minimizeWindow()}
        >
          <Minus className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-9 rounded-none hover:bg-secondary"
          title="最大化 / 还原"
          onClick={() => void window.api.toggleMaximizeWindow()}
        >
          <Square className="h-3 w-3" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-9 rounded-none hover:bg-destructive hover:text-white"
          title="隐藏到托盘"
          onClick={() => void window.api.closeWindow()}
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>
    </header>
  )
}
