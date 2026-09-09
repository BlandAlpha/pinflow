import { Keyboard } from 'lucide-react'

export function EmptyState({
  title,
  description,
  showShortcut = false
}: {
  title: string
  description?: string
  showShortcut?: boolean
}) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-2 py-16 text-center">
      <div className="rounded-full bg-secondary p-3 text-muted-foreground">
        <Keyboard className="h-6 w-6" />
      </div>
      <div className="text-[13px] font-medium">{title}</div>
      {description && <div className="max-w-xs text-[12px] text-muted-foreground">{description}</div>}
      {showShortcut && (
        <div className="mt-2 rounded-md border border-border bg-secondary/60 px-2.5 py-1 font-mono text-[12px] text-muted-foreground">
          Ctrl + Shift + Space 全局快速捕获
        </div>
      )}
    </div>
  )
}
