import { useEffect, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { Zap } from 'lucide-react'
import './index.css'

/**
 * 全局快速捕获窗口：
 * Ctrl+Shift+Space -> 输入 -> Enter 保存到收件箱 -> 窗口自动关闭；Esc 取消。
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
      ref.current?.select()
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
    <div className="flex h-screen flex-col justify-center gap-1.5 border-b border-primary/40 bg-background px-3 pb-2.5 pt-1.5 shadow-2xl">
      <div className="flex items-center gap-2">
        <Zap className="h-4 w-4 shrink-0 text-primary" fill="currentColor" />
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
      </div>
      <div className="pl-6 text-[11px] leading-none text-muted-foreground">
        Enter 保存到收件箱 · Esc 取消
      </div>
    </div>
  )
}

const root = document.getElementById('root')
if (root) {
  createRoot(root).render(<CaptureApp />)
}
