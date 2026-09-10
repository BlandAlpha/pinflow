import { BrowserWindow, app, ipcMain, shell } from 'electron'
import { IPC } from '@shared/ipc'
import type {
  AppPrefs,
  CreateSpaceInput,
  CreateTodoInput,
  Quadrant,
  Step,
  ThemeMode,
  Todo,
  UpdateSpaceInput,
  UpdateTodoInput
} from '@shared/types'
import * as db from './db'
import {
  applyTheme,
  getPrefs,
  resolvedTheme,
  setActiveSpace,
  setTheme
} from './prefs'

/** preload 首帧同步读取的主题快照 */
export interface ThemeSnapshot {
  mode: ThemeMode
  resolved: 'light' | 'dark'
}
import {
  closeMainWindow,
  hideCaptureWindow,
  minimizeMainWindow,
  showMainWindow,
  toggleMaximizeMainWindow
} from './windows'

/** 数据变更广播：通知所有窗口刷新 */
export function broadcastDataChanged(): void {
  for (const win of BrowserWindow.getAllWindows()) {
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
    broadcastDataChanged()
    return todo
  })

  ipcMain.handle(IPC.TODOS_UPDATE, (_e, input: UpdateTodoInput): Todo => {
    const todo = db.updateTodo(input)
    broadcastDataChanged()
    return todo
  })

  ipcMain.handle(IPC.TODOS_DELETE, (_e, id: string): boolean => {
    const ok = db.deleteTodo(id)
    broadcastDataChanged()
    return ok
  })

  ipcMain.handle(IPC.TODOS_TOGGLE, (_e, id: string): Todo => {
    const todo = db.toggleTodo(id)
    broadcastDataChanged()
    return todo
  })
  ipcMain.handle(IPC.TODOS_SET_QUADRANT, (_e, id: string, q: Quadrant): Todo => {
    const todo = db.setQuadrant(id, q)
    broadcastDataChanged()
    return todo
  })
  ipcMain.handle(
    IPC.TODOS_SET_POSITION,
    (_e, id: string, x: number, y: number): Todo => {
      const todo = db.setBoardPosition(id, x, y)
      broadcastDataChanged()
      return todo
    }
  )
  ipcMain.handle(IPC.TODOS_REORDER, (_e, orderedIds: string[]): Todo[] => {
    const todos = db.reorderTodos(orderedIds)
    broadcastDataChanged()
    return todos
  })
  ipcMain.handle(IPC.TODOS_ADD_TAG, (_e, id: string, tag: string): Todo => {
    const todo = db.addTag(id, tag)
    broadcastDataChanged()
    return todo
  })
  ipcMain.handle(IPC.TODOS_REMOVE_TAG, (_e, id: string, tag: string): Todo => {
    const todo = db.removeTag(id, tag)
    broadcastDataChanged()
    return todo
  })
  ipcMain.handle(IPC.TODOS_ALL_TAGS, (_e, spaceId?: string | null): string[] =>
    db.allTags(spaceId ?? null)
  )

  /* ---------- 空间 ---------- */
  ipcMain.handle(IPC.SPACES_LIST, () => db.listSpaces())
  ipcMain.handle(IPC.SPACES_CREATE, (_e, input: CreateSpaceInput) => {
    const space = db.createSpace(input)
    broadcastDataChanged()
    return space
  })
  ipcMain.handle(IPC.SPACES_UPDATE, (_e, id: string, patch: UpdateSpaceInput) => {
    const space = db.updateSpace(id, patch)
    broadcastDataChanged()
    return space
  })
  ipcMain.handle(IPC.SPACES_DELETE, (_e, id: string, moveToId?: string) => {
    const res = db.deleteSpace(id, moveToId)
    if (res.removed) {
      // 删掉的正是当前空间时，把偏好指向接手任务的空间
      if (getPrefs().activeSpaceId === id) setActiveSpace(res.movedTo)
      broadcastDataChanged()
    }
    return res
  })

  /* ---------- Steps ---------- */
  ipcMain.handle(IPC.STEPS_ADD, (_e, todoId: string, title: string): Step => {
    const step = db.addStep(todoId, title)
    broadcastDataChanged()
    return step
  })
  ipcMain.handle(
    IPC.STEPS_UPDATE,
    (_e, stepId: string, patch: Partial<Pick<Step, 'title' | 'completed'>>): Step => {
      const step = db.updateStep(stepId, patch)
      broadcastDataChanged()
      return step
    }
  )
  ipcMain.handle(IPC.STEPS_DELETE, (_e, stepId: string): boolean => {
    const ok = db.deleteStep(stepId)
    broadcastDataChanged()
    return ok
  })
  ipcMain.handle(IPC.STEPS_TOGGLE, (_e, stepId: string): Step => {
    const step = db.toggleStep(stepId)
    broadcastDataChanged()
    return step
  })
  ipcMain.handle(
    IPC.STEPS_REORDER,
    (_e, todoId: string, ordered: string[]): Step[] => db.reorderSteps(todoId, ordered)
  )

  /* ---------- App ---------- */
  ipcMain.handle(IPC.APP_DB_PATH, (): string => db.getDbPath())
  ipcMain.handle(IPC.APP_OPEN_DB_DIR, (): void => {
    void shell.showItemInFolder(db.getDbPath())
  })
  ipcMain.handle(IPC.APP_QUIT, (): void => app.quit())
  ipcMain.handle(IPC.APP_SHOW_MAIN, (): void => showMainWindow())
  ipcMain.handle(IPC.APP_HIDE_MAIN, (): void => minimizeMainWindow())
  ipcMain.handle(IPC.APP_WIN_MIN, (): void => minimizeMainWindow())
  ipcMain.handle(IPC.APP_WIN_MAX, (): void => toggleMaximizeMainWindow())
  ipcMain.handle(IPC.APP_WIN_CLOSE, (): void => closeMainWindow())
  ipcMain.handle(IPC.APP_GET_AUTO_LAUNCH, (): boolean => {
    return app.getLoginItemSettings().openAtLogin
  })
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
  ipcMain.handle(IPC.APP_SET_AUTO_LAUNCH, (_e, enabled: boolean): boolean => {
    app.setLoginItemSettings({
      openAtLogin: enabled,
      args: ['--startup']
    })
    return app.getLoginItemSettings().openAtLogin
  })

  /* ---------- 快速捕获窗口 ---------- */
  ipcMain.handle(IPC.CAPTURE_SUBMIT, (_e, title: string): void => {
    const trimmed = (title ?? '').trim()
    if (!trimmed) return
    db.createTodo({ title: trimmed })
    broadcastDataChanged()
  })
  ipcMain.handle(IPC.CAPTURE_CLOSE, (): void => {
    hideCaptureWindow()
  })
}
