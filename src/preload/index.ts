import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'
import type { AuthState, ScBridge } from '../shared/types'

const bridge: ScBridge = {
  request: (req) => ipcRenderer.invoke('sc:request', req),
  auth: {
    status: () => ipcRenderer.invoke('auth:status'),
    login: () => ipcRenderer.invoke('auth:login'),
    loginWithToken: (token) => ipcRenderer.invoke('auth:token', token),
    logout: () => ipcRenderer.invoke('auth:logout'),
    onChange: (cb) => {
      const listener = (_e: IpcRendererEvent, state: AuthState): void => cb(state)
      ipcRenderer.on('auth:changed', listener)
      return () => ipcRenderer.removeListener('auth:changed', listener)
    }
  },
  openExternal: (url) => ipcRenderer.invoke('shell:open', url),
  platform: process.platform
}

contextBridge.exposeInMainWorld('sc', bridge)
