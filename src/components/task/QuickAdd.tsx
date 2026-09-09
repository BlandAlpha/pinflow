import { useEffect, useRef, useState } from 'react'
import { Plus } from 'lucide-react'
import { useTodos } from '@/store/todos'
import { Input } from '@/components/ui/input'

/** 顶部快速新增输入框：输入后回车即创建到收件箱 */
export function QuickAdd() {
  const create = useTodos((s) => s.create)
  const [value, setValue] = useState('')
  const [busy, setBusy] = useState(false)
  const ref = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const onFocus = () => ref.current?.focus()
    window.addEventListener('todo:focus-quick-add', onFocus)
    return () => window.removeEventListener('todo:focus-quick-add', onFocus)
  }, [])

  const submit = async () => {
    const title = value.trim()
    if (!title || busy) return
    setBusy(true)
    try {
      await create({ title })
      setValue('')
    } finally {
      setBusy(false)
      ref.current?.focus()
    }
  }

  return (
    <div className="relative">
      <Plus className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        ref={ref}
        value={value}
        placeholder="添加任务，回车保存（N 快速聚焦）"
        className="h-9 pl-8"
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') void submit()
          if (e.key === 'Escape') {
            setValue('')
            ;(e.target as HTMLInputElement).blur()
          }
        }}
      />
    </div>
  )
}
