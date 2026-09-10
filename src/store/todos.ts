import { create } from 'zustand'
import { levelsAt } from '@shared/board'
import { EMPTY_FILTER } from '@shared/types'
import type { TodoApi } from '@shared/ipc'
import type {
  CreateSpaceInput,
  CreateTodoInput,
  Level,
  Quadrant,
  Space,
  Step,
  Todo,
  TodoFilter,
  TodoStatus,
  UpdateSpaceInput,
  UpdateTodoInput,
  ViewKey
} from '@shared/types'

export interface UndoAction {
  message: string
  run: () => Promise<void>
}

interface TodosStore {
  todos: Todo[]
  tags: string[]
  spaces: Space[]
  /** 当前空间（所有视图都只在其中工作） */
  activeSpaceId: string | null
  loading: boolean
  initialized: boolean
  view: ViewKey
  selectedId: string | null
  filter: TodoFilter
  undo: UndoAction | null
  /** 最近一次失败的操作（IPC / SQLite 出错时可见，不再是静默无反应） */
  error: string | null

  setView: (v: ViewKey) => void
  select: (id: string | null) => void
  setFilter: (patch: Partial<TodoFilter>) => void
  refresh: () => Promise<void>
  init: () => Promise<void>

  /** 切换空间（会持久化到偏好，快速捕获窗口也跟着走） */
  setActiveSpace: (id: string) => Promise<void>
  createSpace: (input: CreateSpaceInput) => Promise<void>
  updateSpace: (id: string, patch: UpdateSpaceInput) => Promise<void>
  deleteSpace: (id: string) => Promise<void>
  /** 清除全部数据并重置空间（设置危险区，二次确认后调用） */
  clearAll: () => Promise<void>

  create: (input: CreateTodoInput) => Promise<Todo>
  update: (input: UpdateTodoInput) => Promise<Todo>
  toggle: (id: string) => Promise<void>
  /** 归档（可撤销） */
  archive: (id: string) => Promise<void>
  remove: (id: string) => Promise<void>
  setLevel: (id: string, key: 'importance' | 'urgency', value: Level) => Promise<void>
  setQuadrant: (id: string, q: Quadrant) => Promise<void>
  /** 白板拖拽落点（同时推导重要度/紧急度） */
  setPosition: (id: string, x: number, y: number) => Promise<void>
  /** 白板拖放：本地立即停靠，1 秒后才落库（防闪烁 + 减少读写） */
  setPositionLazy: (id: string, x: number, y: number) => void
  /** 批量落点（白板「整理」）：一次 IPC、一个事务 */
  setPositions: (items: { id: string; x: number; y: number }[]) => Promise<void>
  /** 重新排序（看板拖拽用） */
  reorder: (orderedIds: string[]) => Promise<void>
  togglePin: (id: string) => Promise<void>
  addTag: (id: string, tag: string) => Promise<void>
  removeTag: (id: string, tag: string) => Promise<void>

  addStep: (todoId: string, title: string) => Promise<void>
  toggleStep: (stepId: string) => Promise<void>
  updateStep: (stepId: string, patch: Partial<Pick<Step, 'title'>>) => Promise<void>
  deleteStep: (stepId: string) => Promise<void>

  clearUndo: () => void
  clearError: () => void
  setStatus: (id: string, status: TodoStatus) => Promise<void>
}

const api = (): TodoApi => window.api

/**
 * 初始化只允许执行一次：StrictMode 下 effect 会双跑，
 * 重复注册 onDataChanged 会让每次数据变更都刷新两遍。
 */
let initPromise: Promise<void> | null = null

/** 白板延迟落库：id -> 待写坐标与定时器 */
const pendingBoardWrites = new Map<string, { x: number; y: number; timer: number }>()
const BOARD_WRITE_DELAY_MS = 1000

/**
 * 给 store 上所有方法套一层错误捕获。
 * 之前任何一步 IPC / SQLite 失败都被 `void promise` 直接吞掉，界面毫无反应；
 * 这里统一收敛成一个可见的 error，调用方不必逐个写 try/catch。
 * 注意：fn 在 await 之前同步调用，同步 action 的时序不受影响。
 */
function withErrorCatch(set: (p: Partial<TodosStore>) => void, store: TodosStore): TodosStore {
  const wrapped = { ...store } as Record<string, unknown>
  for (const key of Object.keys(store) as (keyof TodosStore)[]) {
    const fn = store[key]
    if (typeof fn !== 'function') continue
    wrapped[key] = async (...args: unknown[]) => {
      try {
        return await (fn as (...a: unknown[]) => unknown)(...args)
      } catch (err) {
        const detail = err instanceof Error ? err.message : String(err)
        console.error(`[todos] ${String(key)} 失败`, err)
        set({ error: `操作失败：${detail}` })
        return undefined
      }
    }
  }
  return wrapped as unknown as TodosStore
}

export const useTodos = create<TodosStore>((set, get) => {
  const store: TodosStore = {
    todos: [],
    tags: [],
    spaces: [],
    activeSpaceId: null,
    loading: true,
    initialized: false,
    view: 'inbox',
    selectedId: null,
    filter: { ...EMPTY_FILTER },
    undo: null,
    error: null,

    setView: (v) => set({ view: v, selectedId: null }),
    select: (id) => set({ selectedId: id }),
    setFilter: (patch) => set((s) => ({ filter: { ...s.filter, ...patch } })),

    init: async () => {
      if (initPromise) return initPromise
      initPromise = (async () => {
        // 先定下空间，再拉数据：标签等派生数据才不会对不上
        const [prefs, spaces] = await Promise.all([api().getPrefs(), api().listSpaces()])
        // 偏好里记住的空间可能已被删除，回退到第一个
        const activeSpaceId =
          prefs.activeSpaceId && spaces.some((s) => s.id === prefs.activeSpaceId)
            ? prefs.activeSpaceId
            : (spaces[0]?.id ?? null)
        set({ spaces, activeSpaceId })
        await get().refresh()
        set({ initialized: true })
        // store 的生命周期 = 应用生命周期，这两个订阅不需要退订
        window.api.onDataChanged(() => {
          void get().refresh()
        })
        window.api.onNewTask(() => {
          set({ view: 'inbox', selectedId: null })
          // 打开新建输入框由视图层通过 focusQuickAdd 实现
          window.dispatchEvent(new CustomEvent('todo:focus-quick-add'))
        })
      })()
      return initPromise
    },

    refresh: async () => {
      const activeSpaceId = get().activeSpaceId
      const [todos, tags, spaces] = await Promise.all([
        api().listTodos(),
        api().allTags(activeSpaceId),
        api().listSpaces()
      ])
      const nextActive =
        activeSpaceId && spaces.some((s) => s.id === activeSpaceId)
          ? activeSpaceId
          : (spaces[0]?.id ?? null)
      // 延迟落库期间的位置不被回程刷新冲掉（卡片不回弹）
      const merged = todos.map((t) => {
        const p = pendingBoardWrites.get(t.id)
        return p ? { ...t, boardX: p.x, boardY: p.y } : t
      })
      set({ todos: merged, tags, spaces, activeSpaceId: nextActive, loading: false })
    },

    setActiveSpace: async (id) => {
      if (get().activeSpaceId === id) return
      await api().setActiveSpace(id)
      set({ activeSpaceId: id, selectedId: null, undo: null })
      await get().refresh()
    },

    createSpace: async (input) => {
      const space = await api().createSpace(input)
      await api().setActiveSpace(space.id)
      set({ activeSpaceId: space.id })
      await get().refresh()
    },

    updateSpace: async (id, patch) => {
      await api().updateSpace(id, patch)
      await get().refresh()
    },

    deleteSpace: async (id) => {
      const res = await api().deleteSpace(id)
      if (!res.removed) return
      // 主进程已把偏好切到接手任务的空间，这里只需要重拉一次
      await get().refresh()
      if (res.movedTo) set({ activeSpaceId: res.movedTo })
    },

    clearAll: async () => {
      await api().clearAllData()
      set({ activeSpaceId: null, selectedId: null, undo: null })
      await get().refresh()
    },

    create: async (input) => {
      const todo = await api().createTodo({
        ...input,
        spaceId: input.spaceId ?? get().activeSpaceId ?? undefined
      })
      await get().refresh()
      return todo
    },

    update: async (input) => {
      const todo = await api().updateTodo(input)
      await get().refresh()
      return todo
    },

    toggle: async (id) => {
      await api().toggleTodo(id)
      await get().refresh()
    },

    setStatus: async (id, status) => {
      await api().updateTodo({ id, status })
      await get().refresh()
    },

    archive: async (id) => {
      const todo = get().todos.find((t) => t.id === id)
      await api().updateTodo({ id, status: 'archived' })
      await get().refresh()
      if (get().selectedId === id) set({ selectedId: null })
      set({
        undo: {
          message: `已归档「${todo?.title ?? id}」`,
          run: async () => {
            await api().updateTodo({ id, status: 'active' })
            await get().refresh()
            set({ undo: null })
          }
        }
      })
    },

    remove: async (id) => {
      const todo = get().todos.find((t) => t.id === id)
      await api().deleteTodo(id)
      await get().refresh()
      if (get().selectedId === id) set({ selectedId: null })
      set({
        undo: {
          message: `已删除「${todo?.title ?? id}」`,
          run: async () => {
            // 整行原样恢复：连 id / 创建时间 / 状态 / 步骤一起回来
            if (todo) await api().restoreTodo(todo)
            await get().refresh()
            set({ undo: null })
          }
        }
      })
    },

    setLevel: async (id, key, value) => {
      await api().updateTodo({ id, [key]: value })
      await get().refresh()
    },

    setQuadrant: async (id, q) => {
      await api().setQuadrant(id, q)
      await get().refresh()
    },

    setPosition: async (id, x, y) => {
      await api().setPosition(id, x, y)
      await get().refresh()
    },

    setPositionLazy: (id, x, y) => {
      // 1. 本地立即停靠（含按坐标推导的等级）：卡片停在放手的位置，不回弹
      const levels = levelsAt({ x, y })
      set((s) => ({
        todos: s.todos.map((t) =>
          t.id === id ? { ...t, boardX: x, boardY: y, ...levels, classified: true } : t
        )
      }))
      // 2. 1 秒后再落库；期间再次拖同一张卡则重置计时，避免连续读写
      const prev = pendingBoardWrites.get(id)
      if (prev) window.clearTimeout(prev.timer)
      const timer = window.setTimeout(() => {
        pendingBoardWrites.delete(id)
        void get().setPosition(id, x, y)
      }, BOARD_WRITE_DELAY_MS)
      pendingBoardWrites.set(id, { x, y, timer })
    },

    setPositions: async (items) => {
      // 接口直接返回变更后的完整列表，不需要再 refresh 一次
      const todos = await api().setPositions(items)
      set({ todos })
    },

    reorder: async (orderedIds) => {
      const todos = await api().reorderTodos(orderedIds)
      set({ todos })
    },

    togglePin: async (id) => {
      const todo = get().todos.find((t) => t.id === id)
      if (!todo) return
      await api().updateTodo({ id, pinned: !todo.pinned })
      await get().refresh()
    },

    addTag: async (id, tag) => {
      await api().addTag(id, tag)
      await get().refresh()
    },

    removeTag: async (id, tag) => {
      await api().removeTag(id, tag)
      await get().refresh()
    },

    addStep: async (todoId, title) => {
      await api().addStep(todoId, title)
      await get().refresh()
    },

    toggleStep: async (stepId) => {
      await api().toggleStep(stepId)
      await get().refresh()
    },

    updateStep: async (stepId, patch) => {
      await api().updateStep(stepId, patch)
      await get().refresh()
    },

    deleteStep: async (stepId) => {
      await api().deleteStep(stepId)
      await get().refresh()
    },

    clearUndo: () => set({ undo: null }),
    clearError: () => set({ error: null })
  }

  return withErrorCatch(set, store)
})
