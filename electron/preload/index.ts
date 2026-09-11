import { contextBridge, ipcRenderer } from 'electron'
import { IPC } from '@shared/ipc'
import type { CaptureApi, TodoApi } from '@shared/ipc'
import type { Platform } from '@shared/platform'
import type { AppPrefs, Todo, UpdateStatus } from '@shared/types'
import { installThemeBootstrap } from './theme'

const themeSnapshot = installThemeBootstrap()

const api: TodoApi & { themeSnapshot: typeof themeSnapshot } = {
  // 渲染进程没有 process：平台值在这里同步注入，首帧即可用于布局与文案
  platform: process.platform as Platform,
  listTodos: (): Promise<Todo[]> => ipcRenderer.invoke(IPC.TODOS_LIST),
  createTodo: (input) => ipcRenderer.invoke(IPC.TODOS_CREATE, input),
  updateTodo: (input) => ipcRenderer.invoke(IPC.TODOS_UPDATE, input),
  deleteTodo: (id) => ipcRenderer.invoke(IPC.TODOS_DELETE, id),
  toggleTodo: (id) => ipcRenderer.invoke(IPC.TODOS_TOGGLE, id),
  setQuadrant: (id, q) => ipcRenderer.invoke(IPC.TODOS_SET_QUADRANT, id, q),
  setPosition: (id, x, y) => ipcRenderer.invoke(IPC.TODOS_SET_POSITION, id, x, y),
  setPositions: (items) => ipcRenderer.invoke(IPC.TODOS_SET_POSITIONS, items),
  restoreTodo: (todo) => ipcRenderer.invoke(IPC.TODOS_RESTORE, todo),
  reorderTodos: (ids) => ipcRenderer.invoke(IPC.TODOS_REORDER, ids),
  addTag: (id, tag) => ipcRenderer.invoke(IPC.TODOS_ADD_TAG, id, tag),
  removeTag: (id, tag) => ipcRenderer.invoke(IPC.TODOS_REMOVE_TAG, id, tag),
  allTags: (spaceId?: string | null): Promise<string[]> =>
    ipcRenderer.invoke(IPC.TODOS_ALL_TAGS, spaceId ?? null),

  listSpaces: () => ipcRenderer.invoke(IPC.SPACES_LIST),
  createSpace: (input) => ipcRenderer.invoke(IPC.SPACES_CREATE, input),
  updateSpace: (id, patch) => ipcRenderer.invoke(IPC.SPACES_UPDATE, id, patch),
  deleteSpace: (id, moveToId) => ipcRenderer.invoke(IPC.SPACES_DELETE, id, moveToId),
  clearAllData: (): Promise<void> => ipcRenderer.invoke(IPC.DATA_CLEAR_ALL),

  addStep: (todoId, title) => ipcRenderer.invoke(IPC.STEPS_ADD, todoId, title),
  updateStep: (stepId, patch) => ipcRenderer.invoke(IPC.STEPS_UPDATE, stepId, patch),
  deleteStep: (stepId) => ipcRenderer.invoke(IPC.STEPS_DELETE, stepId),
  toggleStep: (stepId) => ipcRenderer.invoke(IPC.STEPS_TOGGLE, stepId),

  dbPath: (): Promise<string> => ipcRenderer.invoke(IPC.APP_DB_PATH),
  openDbDir: (): Promise<void> => ipcRenderer.invoke(IPC.APP_OPEN_DB_DIR),
  getVersion: (): Promise<string> => ipcRenderer.invoke(IPC.APP_GET_VERSION),
  openExternal: (url: string): Promise<void> => ipcRenderer.invoke(IPC.APP_OPEN_EXTERNAL, url),
  quitApp: (): Promise<void> => ipcRenderer.invoke(IPC.APP_QUIT),
  minimizeWindow: (): Promise<void> => ipcRenderer.invoke(IPC.APP_WIN_MIN),
  toggleMaximizeWindow: (): Promise<void> => ipcRenderer.invoke(IPC.APP_WIN_MAX),
  closeWindow: (): Promise<void> => ipcRenderer.invoke(IPC.APP_WIN_CLOSE),
  getAutoLaunch: (): Promise<boolean> => ipcRenderer.invoke(IPC.APP_GET_AUTO_LAUNCH),
  setAutoLaunch: (enabled): Promise<boolean> => ipcRenderer.invoke(IPC.APP_SET_AUTO_LAUNCH, enabled),
  getPrefs: (): Promise<AppPrefs> => ipcRenderer.invoke(IPC.APP_GET_PREFS),
  setTheme: (theme) => ipcRenderer.invoke(IPC.APP_SET_THEME, theme),
  setActiveSpace: (id) => ipcRenderer.invoke(IPC.APP_SET_ACTIVE_SPACE, id),
  setCaptureShortcut: (enabled): Promise<AppPrefs> =>
    ipcRenderer.invoke(IPC.APP_SET_CAPTURE_SHORTCUT, enabled),
  setFullscreenGuard: (enabled): Promise<AppPrefs> =>
    ipcRenderer.invoke(IPC.APP_SET_FULLSCREEN_GUARD, enabled),
  getShortcutState: () => ipcRenderer.invoke(IPC.APP_GET_SHORTCUT_STATE),

  getUpdateStatus: (): Promise<UpdateStatus> => ipcRenderer.invoke(IPC.APP_UPDATE_STATUS),
  checkForUpdates: (): Promise<UpdateStatus> => ipcRenderer.invoke(IPC.APP_UPDATE_CHECK),
  downloadUpdate: (): Promise<UpdateStatus> => ipcRenderer.invoke(IPC.APP_UPDATE_DOWNLOAD),
  installUpdate: (): Promise<void> => ipcRenderer.invoke(IPC.APP_UPDATE_INSTALL),
  onUpdateStatus: (cb) => {
    const listener = (_e: unknown, status: UpdateStatus) => cb(status)
    ipcRenderer.on(IPC.UPDATE_STATUS_CHANGED, listener)
    return () => ipcRenderer.removeListener(IPC.UPDATE_STATUS_CHANGED, listener)
  },

  onPrefsChanged: (cb) => {
    const listener = (_e: unknown, prefs: AppPrefs) => cb(prefs)
    ipcRenderer.on(IPC.PREFS_CHANGED, listener)
    return () => ipcRenderer.removeListener(IPC.PREFS_CHANGED, listener)
  },

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
