import { create } from 'zustand'
import { EMPTY_FILTER } from '@shared/types'
import type { TodoApi } from '@shared/ipc'
import type {
  CreateTodoInput,
  Level,
  Quadrant,
  Step,
  Todo,
  TodoFilter,
  TodoStatus,
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

  create: (input: CreateTodoInput) => Promise<Todo>
  update: (input: UpdateTodoInput) => Promise<Todo>
  toggle: (id: string) => Promise<void>
  /** 归档（可撤销） */
  archive: (id: string) => Promise<void>
  remove: (id: string) => Promise<void>
  setLevel: (id: string, key: 'importance' | 'urgency', value: Level) => Promise<void>
  setQuadrant: (id: string, q: Quadrant) => Promise<void>
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
    const [todos, tags] = await Promise.all([api().listTodos(), api().allTags()])
    set({ todos, tags, loading: false })
  },

  create: async (input) => {
    const todo = await api().createTodo(input)
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
            notes: todo?.notes,
            importance: todo?.importance,
            urgency: todo?.urgency,
            dueAt: todo?.dueAt,
            tags: todo?.tags,
            pinned: todo?.pinned
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
