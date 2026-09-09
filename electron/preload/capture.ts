import { contextBridge, ipcRenderer } from 'electron'
import { IPC } from '@shared/ipc'
import type { CaptureApi } from '@shared/ipc'

const api: CaptureApi = {
  submit: (title) => ipcRenderer.invoke(IPC.CAPTURE_SUBMIT, title),
  close: () => ipcRenderer.invoke(IPC.CAPTURE_CLOSE),
  onReady: (cb) => {
    const listener = () => cb()
    ipcRenderer.on(IPC.CAPTURE_READY, listener)
    return () => ipcRenderer.removeListener(IPC.CAPTURE_READY, listener)
  }
}

contextBridge.exposeInMainWorld('capture', api)
