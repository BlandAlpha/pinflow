import { BrowserWindow, app, ipcMain, shell } from 'electron'
import { IPC } from '@shared/ipc'
import type {
  AppPrefs,
  CreateSpaceInput,
  CreateTodoInput,
  Quadrant,
  ShortcutState,
  Step,
  ThemeMode,
  Todo,
  UpdateSpaceInput,
  UpdateStatus,
  UpdateTodoInput
} from '@shared/types'
import * as db from './db'
import {
  applyTheme,
  broadcastPrefsChanged,
  getPrefs,
  resolvedTheme,
  setActiveSpace,
  setTheme
} from './prefs'
import { getAutoLaunch, setAutoLaunch } from './autolaunch'
import { getShortcutState, setCaptureShortcutEnabled, setFullscreenGuardEnabled } from './shortcut'
import { refreshTrayMenu } from './tray'
import {
  checkForUpdates,
  downloadUpdate,
  getUpdateStatus,
  installUpdate
} from './updater'

/** preload 首帧同步读取的主题快照 */
export interface ThemeSnapshot {
  mode: ThemeMode
  resolved: 'light' | 'dark'
}
import {
  closeMainWindow,
  hideCaptureWindow,
  minimizeMainWindow,
  toggleMaximizeMainWindow
} from './windows'

/**
 * 数据变更广播：通知所有窗口刷新。
 * 传入 originId（invoke 事件的 sender.id）时会跳过来源窗口 —— 它自己在
 * await 完 IPC 之后已经 refresh 过一次，没必要再全量拉一遍。
 */
export function broadcastDataChanged(originId?: number): void {
  for (const win of BrowserWindow.getAllWindows()) {
    if (originId !== undefined && win.webContents.id === originId) continue
    win.webContents.send(IPC.DATA_CHANGED)
  }
}

/** 主题变更广播 */
export function broadcastTheme(mode: ThemeMode): void {
  const snapshot: ThemeSnapshot = { mode, resolved: resolvedTheme() }
  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send('app:theme:changed', snapshot)
  }
}

export function registerIpcHandlers(): void {
  /* ---------- Todos ---------- */
  ipcMain.handle(IPC.TODOS_LIST, (): Todo[] => db.listTodos())

  ipcMain.handle(IPC.TODOS_CREATE, (_e, input: CreateTodoInput): Todo => {
    const todo = db.createTodo(input)
    broadcastDataChanged(_e.sender.id)
    return todo
  })

  ipcMain.handle(IPC.TODOS_UPDATE, (_e, input: UpdateTodoInput): Todo => {
    const todo = db.updateTodo(input)
    broadcastDataChanged(_e.sender.id)
    return todo
  })

  ipcMain.handle(IPC.TODOS_DELETE, (_e, id: string): boolean => {
    const ok = db.deleteTodo(id)
    broadcastDataChanged(_e.sender.id)
    return ok
  })

  ipcMain.handle(IPC.TODOS_TOGGLE, (_e, id: string): Todo => {
    const todo = db.toggleTodo(id)
    broadcastDataChanged(_e.sender.id)
    return todo
  })
  ipcMain.handle(IPC.TODOS_SET_QUADRANT, (_e, id: string, q: Quadrant): Todo => {
    const todo = db.setQuadrant(id, q)
    broadcastDataChanged(_e.sender.id)
    return todo
  })
  ipcMain.handle(
    IPC.TODOS_SET_POSITION,
    (_e, id: string, x: number, y: number): Todo => {
      const todo = db.setBoardPosition(id, x, y)
      broadcastDataChanged(_e.sender.id)
      return todo
    }
  )
  ipcMain.handle(
    IPC.TODOS_SET_POSITIONS,
    (_e, items: { id: string; x: number; y: number }[]): Todo[] => {
      const todos = db.setBoardPositions(items)
      broadcastDataChanged(_e.sender.id)
      return todos
    }
  )
  ipcMain.handle(IPC.TODOS_RESTORE, (_e, todo: Todo): Todo => {
    const restored = db.restoreTodo(todo)
    broadcastDataChanged(_e.sender.id)
    return restored
  })
  ipcMain.handle(IPC.TODOS_REORDER, (_e, orderedIds: string[]): Todo[] => {
    const todos = db.reorderTodos(orderedIds)
    broadcastDataChanged(_e.sender.id)
    return todos
  })
  ipcMain.handle(IPC.TODOS_ADD_TAG, (_e, id: string, tag: string): Todo => {
    const todo = db.addTag(id, tag)
    broadcastDataChanged(_e.sender.id)
    return todo
  })
  ipcMain.handle(IPC.TODOS_REMOVE_TAG, (_e, id: string, tag: string): Todo => {
    const todo = db.removeTag(id, tag)
    broadcastDataChanged(_e.sender.id)
    return todo
  })
  ipcMain.handle(IPC.TODOS_ALL_TAGS, (_e, spaceId?: string | null): string[] =>
    db.allTags(spaceId ?? null)
  )

  /* ---------- 空间 ---------- */
  ipcMain.handle(IPC.SPACES_LIST, () => db.listSpaces())
  ipcMain.handle(IPC.SPACES_CREATE, (_e, input: CreateSpaceInput) => {
    const space = db.createSpace(input)
    broadcastDataChanged(_e.sender.id)
    return space
  })
  ipcMain.handle(IPC.SPACES_UPDATE, (_e, id: string, patch: UpdateSpaceInput) => {
    const space = db.updateSpace(id, patch)
    broadcastDataChanged(_e.sender.id)
    return space
  })
  ipcMain.handle(IPC.SPACES_DELETE, (_e, id: string, moveToId?: string) => {
    const res = db.deleteSpace(id, moveToId)
    if (res.removed) {
      // 删掉的正是当前空间时，把偏好指向接手任务的空间
      if (getPrefs().activeSpaceId === id) setActiveSpace(res.movedTo)
      broadcastDataChanged(_e.sender.id)
    }
    return res
  })

  /* ---------- Steps ---------- */
  ipcMain.handle(IPC.STEPS_ADD, (_e, todoId: string, title: string): Step => {
    const step = db.addStep(todoId, title)
    broadcastDataChanged(_e.sender.id)
    return step
  })
  ipcMain.handle(
    IPC.STEPS_UPDATE,
    (_e, stepId: string, patch: Partial<Pick<Step, 'title' | 'completed'>>): Step => {
      const step = db.updateStep(stepId, patch)
      broadcastDataChanged(_e.sender.id)
      return step
    }
  )
  ipcMain.handle(IPC.STEPS_DELETE, (_e, stepId: string): boolean => {
    const ok = db.deleteStep(stepId)
    broadcastDataChanged(_e.sender.id)
    return ok
  })
  ipcMain.handle(IPC.STEPS_TOGGLE, (_e, stepId: string): Step => {
    const step = db.toggleStep(stepId)
    broadcastDataChanged(_e.sender.id)
    return step
  })
  /* ---------- App ---------- */
  ipcMain.handle(IPC.APP_DB_PATH, (): string => db.getDbPath())
  ipcMain.handle(IPC.APP_OPEN_DB_DIR, (): void => {
    void shell.showItemInFolder(db.getDbPath())
  })
  ipcMain.handle(IPC.APP_QUIT, (): void => app.quit())
  ipcMain.handle(IPC.APP_WIN_MIN, (): void => minimizeMainWindow())
  ipcMain.handle(IPC.APP_GET_VERSION, (): string => app.getVersion())
  // 只放行 https 链接：渲染进程不可用来拉起 file:// 或自定义协议
  ipcMain.handle(IPC.APP_OPEN_EXTERNAL, (_e, url: string): void => {
    if (typeof url === 'string' && /^https:\/\//.test(url)) void shell.openExternal(url)
  })

  ipcMain.handle(IPC.DATA_CLEAR_ALL, (_e): void => {
    db.clearAllData()
    // 偏好里记住的空间已被重置掉，退回默认
    setActiveSpace(null)
    broadcastDataChanged(_e.sender.id)
  })
  ipcMain.handle(IPC.APP_WIN_MAX, (): void => toggleMaximizeMainWindow())
  ipcMain.handle(IPC.APP_WIN_CLOSE, (): void => closeMainWindow())
  ipcMain.handle(IPC.APP_GET_AUTO_LAUNCH, (): Promise<boolean> => getAutoLaunch())
  // 同步通道：preload 在首帧前拿到主题，避免主题闪烁
  ipcMain.on('app:theme:sync', (e) => {
    e.returnValue = { mode: getPrefs().theme, resolved: resolvedTheme() } as ThemeSnapshot
  })
  ipcMain.handle(IPC.APP_GET_PREFS, (): AppPrefs => getPrefs())
  ipcMain.handle(IPC.APP_SET_THEME, (_e, theme: ThemeMode): AppPrefs => {
    const prefs = setTheme(theme)
    applyTheme(prefs.theme)
    broadcastTheme(prefs.theme)
    return prefs
  })
  ipcMain.handle(IPC.APP_SET_ACTIVE_SPACE, (_e, id: string | null): AppPrefs =>
    setActiveSpace(id)
  )
  // 快捷键开关：改完立刻同步注册状态，并把偏好广播给其它窗口（托盘菜单也要跟着变）
  ipcMain.handle(IPC.APP_SET_CAPTURE_SHORTCUT, (_e, enabled: boolean): AppPrefs => {
    setCaptureShortcutEnabled(enabled)
    broadcastPrefsChanged()
    refreshTrayMenu()
    return getPrefs()
  })
  ipcMain.handle(IPC.APP_SET_FULLSCREEN_GUARD, (_e, enabled: boolean): AppPrefs => {
    setFullscreenGuardEnabled(enabled)
    broadcastPrefsChanged()
    refreshTrayMenu()
    return getPrefs()
  })
  ipcMain.handle(IPC.APP_GET_SHORTCUT_STATE, (): ShortcutState => getShortcutState())

  /* ---------- 应用内更新 ---------- */
  ipcMain.handle(IPC.APP_UPDATE_STATUS, (): UpdateStatus => getUpdateStatus())
  ipcMain.handle(IPC.APP_UPDATE_CHECK, (): Promise<UpdateStatus> => checkForUpdates())
  ipcMain.handle(IPC.APP_UPDATE_DOWNLOAD, (): Promise<UpdateStatus> => downloadUpdate())
  ipcMain.handle(IPC.APP_UPDATE_INSTALL, (): void => installUpdate())
  ipcMain.handle(
    IPC.APP_SET_AUTO_LAUNCH,
    (_e, enabled: boolean): Promise<boolean> => setAutoLaunch(enabled)
  )

  /* ---------- 快速捕获窗口 ---------- */
  ipcMain.handle(IPC.CAPTURE_SUBMIT, (_e, title: string): void => {
    const trimmed = (title ?? '').trim()
    if (!trimmed) return
    db.createTodo({ title: trimmed })
    broadcastDataChanged(_e.sender.id)
  })
  ipcMain.handle(IPC.CAPTURE_CLOSE, (): void => {
    hideCaptureWindow()
  })
}
