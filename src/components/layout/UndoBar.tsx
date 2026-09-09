import { useEffect } from 'react'
import { RotateCcw, X } from 'lucide-react'
import { useTodos } from '@/store/todos'
import { Button } from '@/components/ui/button'

const AUTO_DISMISS_MS = 8000

export function UndoBar() {
  const undo = useTodos((s) => s.undo)
  const clearUndo = useTodos((s) => s.clearUndo)

  useEffect(() => {
    if (!undo) return
    const timer = window.setTimeout(clearUndo, AUTO_DISMISS_MS)
    return () => window.clearTimeout(timer)
  }, [undo, clearUndo])

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
