import { create } from 'zustand'
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
  setStatus: (id: string, status: TodoStatus) => Promise<void>
}

const api = (): TodoApi => window.api
export const useTodos = create<TodosStore>((set, get) => ({
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

  setView: (v) => set({ view: v, selectedId: null }),
  select: (id) => set({ selectedId: id }),
  setFilter: (patch) => set((s) => ({ filter: { ...s.filter, ...patch } })),

  init: async () => {
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
    window.api.onDataChanged(() => {
      void get().refresh()
    })
    window.api.onNewTask(() => {
      set({ view: 'inbox', selectedId: null })
      // 打开新建输入框由视图层通过 focusQuickAdd 实现
      window.dispatchEvent(new CustomEvent('todo:focus-quick-add'))
    })
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
    set({ todos, tags, spaces, activeSpaceId: nextActive, loading: false })
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
    await get().refresh()
    if (res.movedTo) await api().setActiveSpace(res.movedTo)
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
          await api().createTodo({
            title: todo?.title ?? '',
            spaceId: todo?.spaceId,
            notes: todo?.notes,
            importance: todo?.importance,
            urgency: todo?.urgency,
            dueAt: todo?.dueAt,
            tags: todo?.tags,
            pinned: todo?.pinned,
            classified: todo?.classified,
            boardX: todo?.boardX,
            boardY: todo?.boardY
          })
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

  clearUndo: () => set({ undo: null })
}))
