import { useEffect } from 'react'
import { AlertTriangle, RotateCcw, X } from 'lucide-react'
import { useTodos } from '@/store/todos'
import { Button } from '@/components/ui/button'

const AUTO_DISMISS_MS = 8000

/** 操作失败提示：与撤销条互斥，失败优先（用户需要知道发生了什么） */
function ErrorBar() {
  const error = useTodos((s) => s.error)
  const clearError = useTodos((s) => s.clearError)

  useEffect(() => {
    if (!error) return
    const timer = window.setTimeout(clearError, AUTO_DISMISS_MS)
    return () => window.clearTimeout(timer)
  }, [error, clearError])

  if (!error) return null

  return (
    <div className="pointer-events-none absolute bottom-4 left-1/2 z-50 -translate-x-1/2 animate-fade-in">
      <div className="pointer-events-auto flex max-w-[520px] items-center gap-2 rounded-lg border border-destructive/40 bg-popover px-3 py-2 text-[12px] shadow-xl">
        <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-destructive" />
        <span className="truncate text-foreground" title={error}>
          {error}
        </span>
        <Button variant="ghost" size="icon-sm" className="h-6 w-6 shrink-0" onClick={clearError}>
          <X className="h-3 w-3" />
        </Button>
      </div>
    </div>
  )
}

/** 底部浮层：先显示错误，没有错误时再显示可撤销提示 */
export function UndoBar() {
  const error = useTodos((s) => s.error)
  const undo = useTodos((s) => s.undo)
  const clearUndo = useTodos((s) => s.clearUndo)

  useEffect(() => {
    if (!undo) return
    const timer = window.setTimeout(clearUndo, AUTO_DISMISS_MS)
    return () => window.clearTimeout(timer)
  }, [undo, clearUndo])

  if (error) return <ErrorBar />
  if (!undo) return null

  return (
    <div className="pointer-events-none absolute bottom-4 left-1/2 z-50 -translate-x-1/2 animate-fade-in">
      <div className="pointer-events-auto flex items-center gap-2 rounded-lg border border-border bg-popover px-3 py-2 text-[12px] shadow-xl">
        <span className="text-muted-foreground">{undo.message}</span>
        <Button variant="secondary" size="xs" onClick={() => void undo.run()}>
          <RotateCcw className="h-3 w-3" />
          撤销
        </Button>
        <Button variant="ghost" size="icon-sm" className="h-6 w-6" onClick={clearUndo}>
          <X className="h-3 w-3" />
        </Button>
      </div>
    </div>
  )
}
