import { contextBridge, ipcRenderer } from 'electron'
import { IPC } from '@shared/ipc'
import type { CaptureApi, TodoApi } from '@shared/ipc'
import type { AppPrefs, Todo } from '@shared/types'
import { installThemeBootstrap } from './theme'

const themeSnapshot = installThemeBootstrap()

const api: TodoApi & { themeSnapshot: typeof themeSnapshot } = {
  listTodos: (): Promise<Todo[]> => ipcRenderer.invoke(IPC.TODOS_LIST),
  createTodo: (input) => ipcRenderer.invoke(IPC.TODOS_CREATE, input),
  updateTodo: (input) => ipcRenderer.invoke(IPC.TODOS_UPDATE, input),
  deleteTodo: (id) => ipcRenderer.invoke(IPC.TODOS_DELETE, id),
  toggleTodo: (id) => ipcRenderer.invoke(IPC.TODOS_TOGGLE, id),
  setQuadrant: (id, q) => ipcRenderer.invoke(IPC.TODOS_SET_QUADRANT, id, q),
  setPosition: (id, x, y) => ipcRenderer.invoke(IPC.TODOS_SET_POSITION, id, x, y),
  reorderTodos: (ids) => ipcRenderer.invoke(IPC.TODOS_REORDER, ids),
  addTag: (id, tag) => ipcRenderer.invoke(IPC.TODOS_ADD_TAG, id, tag),
  removeTag: (id, tag) => ipcRenderer.invoke(IPC.TODOS_REMOVE_TAG, id, tag),
  allTags: (): Promise<string[]> => ipcRenderer.invoke(IPC.TODOS_ALL_TAGS),

  addStep: (todoId, title) => ipcRenderer.invoke(IPC.STEPS_ADD, todoId, title),
  updateStep: (stepId, patch) => ipcRenderer.invoke(IPC.STEPS_UPDATE, stepId, patch),
  deleteStep: (stepId) => ipcRenderer.invoke(IPC.STEPS_DELETE, stepId),
  toggleStep: (stepId) => ipcRenderer.invoke(IPC.STEPS_TOGGLE, stepId),
  reorderSteps: (todoId, ordered) => ipcRenderer.invoke(IPC.STEPS_REORDER, todoId, ordered),

  dbPath: (): Promise<string> => ipcRenderer.invoke(IPC.APP_DB_PATH),
  openDbDir: (): Promise<void> => ipcRenderer.invoke(IPC.APP_OPEN_DB_DIR),
  quitApp: (): Promise<void> => ipcRenderer.invoke(IPC.APP_QUIT),
  minimizeWindow: (): Promise<void> => ipcRenderer.invoke(IPC.APP_WIN_MIN),
  toggleMaximizeWindow: (): Promise<void> => ipcRenderer.invoke(IPC.APP_WIN_MAX),
  closeWindow: (): Promise<void> => ipcRenderer.invoke(IPC.APP_WIN_CLOSE),
  getAutoLaunch: (): Promise<boolean> => ipcRenderer.invoke(IPC.APP_GET_AUTO_LAUNCH),
  setAutoLaunch: (enabled): Promise<boolean> => ipcRenderer.invoke(IPC.APP_SET_AUTO_LAUNCH, enabled),
  getPrefs: (): Promise<AppPrefs> => ipcRenderer.invoke(IPC.APP_GET_PREFS),
  setTheme: (theme) => ipcRenderer.invoke(IPC.APP_SET_THEME, theme),

  onDataChanged: (cb) => {
    const listener = () => cb()
    ipcRenderer.on(IPC.DATA_CHANGED, listener)
    return () => ipcRenderer.removeListener(IPC.DATA_CHANGED, listener)
  },
  onNewTask: (cb) => {
    const listener = () => cb()
    ipcRenderer.on(IPC.REQUEST_NEW_TASK, listener)
    return () => ipcRenderer.removeListener(IPC.REQUEST_NEW_TASK, listener)
  },

  themeSnapshot
}

contextBridge.exposeInMainWorld('api', api)

export type { CaptureApi, TodoApi }
