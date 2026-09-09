import { useEffect, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { CornerDownLeft, Zap } from 'lucide-react'
import './index.css'

/**
 * 全局快速捕获：命令面板风格。
 * 快捷键 -> 输入 -> Enter 保存 -> 关闭；Esc 取消。永远不需要先分类。
 */
function CaptureApp() {
  const [value, setValue] = useState('')
  const [busy, setBusy] = useState(false)
  const ref = useRef<HTMLInputElement>(null)

  useEffect(() => {
    ref.current?.focus()
    return window.capture?.onReady(() => {
      setValue('')
      ref.current?.focus()
    })
  }, [])

  const submit = async () => {
    const title = value.trim()
    if (!title || busy) return
    setBusy(true)
    try {
      await window.capture.submit(title)
      setValue('')
      await window.capture.close()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="h-screen bg-background p-1.5">
      <div className="flex h-full flex-col overflow-hidden rounded-lg border border-border bg-popover shadow-pop">
        <div className="flex flex-1 items-center gap-2.5 px-3">
          <Zap className="h-4 w-4 shrink-0 text-primary" />
          <input
            ref={ref}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void submit()
              if (e.key === 'Escape') void window.capture.close()
            }}
            placeholder="要做什么？"
            autoFocus
            spellCheck={false}
            className="w-full bg-transparent text-[15px] text-foreground outline-none placeholder:text-muted-foreground"
          />
          {value.trim() && (
            <span className="flex shrink-0 items-center gap-1 rounded border border-border px-1.5 py-0.5 text-2xs text-muted-foreground">
              <CornerDownLeft className="h-3 w-3" />
              保存
            </span>
          )}
        </div>
        <div className="flex shrink-0 items-center justify-between border-t border-border px-3 py-1.5 text-2xs text-muted-foreground">
          <span>保存到收件箱 · 之后再去分类</span>
          <span>Enter 保存 · Esc 取消</span>
        </div>
      </div>
    </div>
  )
}

const root = document.getElementById('root')
if (root) {
  createRoot(root).render(<CaptureApp />)
}
