/**
 * Electron preload script.
 *
 * Exposes a safe, typed API to the renderer via contextBridge.
 * The renderer accesses this as `window.electronAPI`.
 */
import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  // File dialogs
  showSaveDialog: (options: any) => ipcRenderer.invoke('dialog:save', options),
  showOpenDialog: (options: any) => ipcRenderer.invoke('dialog:open', options),

  // File system
  readFile: (filePath: string) => ipcRenderer.invoke('fs:readFile', filePath),
  writeFile: (filePath: string, data: Uint8Array) => ipcRenderer.invoke('fs:writeFile', filePath, data),

  // App metadata
  getAppDataPath: () => ipcRenderer.invoke('app:getDataPath'),
  getServerUrl: () => ipcRenderer.invoke('app:getServerUrl'),
  setServerUrl: (url: string) => ipcRenderer.invoke('app:setServerUrl', url),

  // DevTools
  toggleDevTools: () => ipcRenderer.invoke('app:toggleDevTools'),

  // Menu actions (main → renderer)
  onMenuAction: (callback: (action: string) => void) => {
    ipcRenderer.on('menu:action', (_event, action: string) => callback(action));
  },
});
