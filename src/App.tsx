import { useEffect, useRef } from 'react'
import { isTypingTarget } from '@/lib/keyboard'
import { useTodos } from '@/store/todos'
import { useVisibleTodos } from '@/hooks/useVisibleTodos'
import { TitleBar } from '@/components/layout/TitleBar'
import { Sidebar } from '@/components/layout/Sidebar'
import { UndoBar } from '@/components/layout/UndoBar'
import { ListView } from '@/components/views/ListView'
import { MatrixView } from '@/components/views/MatrixView'
import { AllView } from '@/components/views/AllView'
import { DetailPanel } from '@/components/detail/DetailPanel'
import { QuickAdd } from '@/components/task/QuickAdd'
import { Badge } from '@/components/ui/badge'
import { TooltipProvider } from '@/components/ui/tooltip'

function InboxHeader() {
  const count = useVisibleTodos().length
  return (
    <div className="shrink-0 space-y-2 border-b border-border p-2">
      <div className="flex items-center gap-2 px-0.5">
        <h1 className="text-[14px] font-semibold">收件箱</h1>
        <Badge variant="secondary">{count}</Badge>
        <span className="ml-auto text-[11px] text-muted-foreground">设置重要/紧急或截止时间后自动移出</span>
      </div>
      <QuickAdd />
    </div>
  )
}

function TodayHeader() {
  const now = new Date()
  const count = useVisibleTodos().length
  const overdue = useTodos(
    (s) =>
      s.todos.filter(
        (t) => t.status === 'active' && t.dueAt && new Date(t.dueAt).getTime() < now.getTime()
      ).length
  )
  const week = ['日', '一', '二', '三', '四', '五', '六'][now.getDay()]
  return (
    <div className="flex shrink-0 items-center gap-2 border-b border-border px-3 py-2">
      <h1 className="text-[14px] font-semibold">今天</h1>
      <span className="text-[12px] text-muted-foreground">
        {now.getMonth() + 1}月{now.getDate()}日 星期{week}
      </span>
      <Badge variant="secondary">{count}</Badge>
      {overdue > 0 && <Badge variant="danger">{overdue} 项逾期</Badge>}
      <span className="ml-auto text-[11px] text-muted-foreground">按优先级自动排序 · 悬停分数查看构成</span>
    </div>
  )
}

export default function App() {
  const init = useTodos((s) => s.init)
  const initialized = useTodos((s) => s.initialized)
  const view = useTodos((s) => s.view)
  const selectedId = useTodos((s) => s.selectedId)
  const select = useTodos((s) => s.select)
  const toggle = useTodos((s) => s.toggle)
  const setQuadrant = useTodos((s) => s.setQuadrant)
  const archive = useTodos((s) => s.archive)
  const remove = useTodos((s) => s.remove)
  const todos = useVisibleTodos()
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    void init()
  }, [init])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!initialized) return
      if (e.key === 'Escape') {
        select(null)
        return
      }
      if (isTypingTarget(e.target)) return

      const idx = selectedId ? todos.findIndex((t) => t.id === selectedId) : -1

      switch (e.key) {
        case 'n':
        case 'N': {
          e.preventDefault()
          window.dispatchEvent(new CustomEvent('todo:focus-quick-add'))
          break
        }
        case 'e':
        case 'E':
        case 'Enter': {
          if (selectedId) break
          if (todos.length > 0) select(todos[0].id)
          break
        }
        case ' ': {
          if (selectedId) {
            e.preventDefault()
            void toggle(selectedId)
          }
          break
        }
        case 'ArrowDown':
        case 'ArrowUp': {
          if (todos.length === 0) break
          e.preventDefault()
          const next =
            e.key === 'ArrowDown'
              ? Math.min(todos.length - 1, idx < 0 ? 0 : idx + 1)
              : Math.max(0, idx < 0 ? 0 : idx - 1)
          select(todos[next].id)
          break
        }
        case '1':
        case '2':
        case '3':
        case '4': {
          if (selectedId) void setQuadrant(selectedId, Number(e.key) as 1 | 2 | 3 | 4)
          break
        }
        case 'Delete': {
          if (!selectedId) break
          if (e.shiftKey) void remove(selectedId)
          else void archive(selectedId)
          break
        }
        default:
          break
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [initialized, selectedId, todos, select, toggle, setQuadrant, archive, remove])

  return (
    <TooltipProvider delayDuration={300}>
      <div className="flex h-full flex-col">
        <TitleBar />
        <div className="flex min-h-0 flex-1">
          <Sidebar />
          <main ref={listRef} className="relative flex min-w-0 flex-1 flex-col">
            {view === 'inbox' && (
              <>
                <InboxHeader />
                <ListView />
              </>
            )}
            {view === 'today' && (
              <>
                <TodayHeader />
                <ListView showScore />
              </>
            )}
            {view === 'matrix' && <MatrixView />}
            {view === 'all' && <AllView />}
            <UndoBar />
          </main>
          {selectedId && <DetailPanel />}
        </div>
      </div>
    </TooltipProvider>
  )
}
