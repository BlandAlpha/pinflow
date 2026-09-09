import { useEffect, useState } from 'react'
import { Database, Power } from 'lucide-react'
import { ThemeSwitcher } from '@/components/theme/ThemeSwitcher'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'

const SHORTCUT = 'Ctrl+Shift+Space'

export function SettingsDialog({
  open,
  onOpenChange
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
}) {
  const [autoStart, setAutoStart] = useState(false)
  const [dbPath, setDbPath] = useState('')

  useEffect(() => {
    if (!open) return
    void window.api.getAutoLaunch().then(setAutoStart)
    void window.api.dbPath().then(setDbPath)
  }, [open])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>设置</DialogTitle>
          <DialogDescription>本地优先，数据只存在这台电脑上</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-[13px]">外观</span>
            <ThemeSwitcher />
          </div>

          <div className="h-px bg-border" />

          <label className="flex cursor-pointer items-center justify-between">
            <span className="flex items-center gap-2 text-[13px]">
              <Power className="h-3.5 w-3.5 text-muted-foreground" />
              开机自动启动
            </span>
            <Checkbox
              checked={autoStart}
              onCheckedChange={(v) => {
                setAutoStart(v === true)
                void window.api.setAutoLaunch(v === true)
              }}
            />
          </label>

          <div className="flex items-center justify-between gap-3">
            <span className="flex items-center gap-2 text-[13px]">
              <Database className="h-3.5 w-3.5 text-muted-foreground" />
              数据库位置
            </span>
            <button
              onClick={() => void window.api.openDbDir()}
              className="max-w-[240px] truncate rounded px-1.5 py-0.5 font-mono text-2xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              title={dbPath}
            >
              {dbPath || '…'}
            </button>
          </div>

          <div className="flex items-center justify-between text-[13px]">
            <span className="text-muted-foreground">快速捕获</span>
            <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-2xs text-muted-foreground">
              {SHORTCUT}
            </kbd>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
