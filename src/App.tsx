import { useEffect } from 'react'
import { isTypingTarget } from '@/lib/keyboard'
import { useTodos } from '@/store/todos'
import { useVisibleTodos } from '@/hooks/useVisibleTodos'
import { ThemeProvider } from '@/components/theme/ThemeProvider'
import { TitleBar } from '@/components/layout/TitleBar'
import { Sidebar } from '@/components/layout/Sidebar'
import { UndoBar } from '@/components/layout/UndoBar'
import { InboxView } from '@/components/views/InboxView'
import { TodayView } from '@/components/views/TodayView'
import { KanbanBoard } from '@/components/views/KanbanBoard'
import { AllView } from '@/components/views/AllView'
import { DetailPanel } from '@/components/detail/DetailPanel'
import { TooltipProvider } from '@/components/ui/tooltip'

function Workspace() {
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
    <div className="flex h-full flex-col">
      <TitleBar />
      <div className="flex min-h-0 flex-1">
        <Sidebar />
        <main className="relative flex min-w-0 flex-1 flex-col">
          {view === 'inbox' && <InboxView />}
          {view === 'today' && <TodayView />}
          {view === 'kanban' && <KanbanBoard />}
          {view === 'all' && <AllView />}
          <UndoBar />
        </main>
        {selectedId && <DetailPanel />}
      </div>
    </div>
  )
}

export default function App() {
  return (
    <ThemeProvider>
      <TooltipProvider delayDuration={400}>
        <Workspace />
      </TooltipProvider>
    </ThemeProvider>
  )
}
