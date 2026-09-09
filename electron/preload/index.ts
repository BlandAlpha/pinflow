import { contextBridge, ipcRenderer } from 'electron'
import { IPC } from '@shared/ipc'
import type { TodoApi } from '@shared/ipc'

const api: TodoApi = {
  listTodos: () => ipcRenderer.invoke(IPC.TODOS_LIST),
  createTodo: (input) => ipcRenderer.invoke(IPC.TODOS_CREATE, input),
  updateTodo: (input) => ipcRenderer.invoke(IPC.TODOS_UPDATE, input),
  deleteTodo: (id) => ipcRenderer.invoke(IPC.TODOS_DELETE, id),
  toggleTodo: (id) => ipcRenderer.invoke(IPC.TODOS_TOGGLE, id),
  setQuadrant: (id, quadrant) => ipcRenderer.invoke(IPC.TODOS_SET_QUADRANT, id, quadrant),
  addTag: (id, tag) => ipcRenderer.invoke(IPC.TODOS_ADD_TAG, id, tag),
  removeTag: (id, tag) => ipcRenderer.invoke(IPC.TODOS_REMOVE_TAG, id, tag),
  allTags: () => ipcRenderer.invoke(IPC.TODOS_ALL_TAGS),

  addStep: (todoId, title) => ipcRenderer.invoke(IPC.STEPS_ADD, todoId, title),
  updateStep: (stepId, patch) => ipcRenderer.invoke(IPC.STEPS_UPDATE, stepId, patch),
  deleteStep: (stepId) => ipcRenderer.invoke(IPC.STEPS_DELETE, stepId),
  toggleStep: (stepId) => ipcRenderer.invoke(IPC.STEPS_TOGGLE, stepId),
  reorderSteps: (todoId, ordered) => ipcRenderer.invoke(IPC.STEPS_REORDER, todoId, ordered),

  dbPath: () => ipcRenderer.invoke(IPC.APP_DB_PATH),
  openDbDir: () => ipcRenderer.invoke(IPC.APP_OPEN_DB_DIR),
  quitApp: () => ipcRenderer.invoke(IPC.APP_QUIT),
  minimizeWindow: () => ipcRenderer.invoke(IPC.APP_WIN_MIN),
  toggleMaximizeWindow: () => ipcRenderer.invoke(IPC.APP_WIN_MAX),
  closeWindow: () => ipcRenderer.invoke(IPC.APP_WIN_CLOSE),
  getAutoLaunch: () => ipcRenderer.invoke(IPC.APP_GET_AUTO_LAUNCH),
  setAutoLaunch: (enabled) => ipcRenderer.invoke(IPC.APP_SET_AUTO_LAUNCH, enabled),

  onDataChanged: (cb) => {
    const listener = () => cb()
    ipcRenderer.on(IPC.DATA_CHANGED, listener)
    return () => ipcRenderer.removeListener(IPC.DATA_CHANGED, listener)
  },
  onNewTask: (cb) => {
    const listener = () => cb()
    ipcRenderer.on(IPC.REQUEST_NEW_TASK, listener)
    return () => ipcRenderer.removeListener(IPC.REQUEST_NEW_TASK, listener)
  }
}

contextBridge.exposeInMainWorld('api', api)
