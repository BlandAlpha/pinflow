import { BrowserWindow, app, ipcMain, shell } from 'electron'
import { IPC } from '@shared/ipc'
import type { CreateTodoInput, Quadrant, Step, Todo, UpdateTodoInput } from '@shared/types'
import * as db from './db'
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

  ipcMain.handle(IPC.TODOS_TOGGLE, (_e, id: string): Todo => db.toggleTodo(id))
  ipcMain.handle(IPC.TODOS_SET_QUADRANT, (_e, id: string, q: Quadrant): Todo => {
    const todo = db.setQuadrant(id, q)
    broadcastDataChanged()
    return todo
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
  ipcMain.handle(IPC.TODOS_ALL_TAGS, (): string[] => db.allTags())

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
  ipcMain.handle(IPC.STEPS_TOGGLE, (_e, stepId: string): Step => db.toggleStep(stepId))
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
