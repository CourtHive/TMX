/**
 * Electron preload script — runs sandboxed, as CommonJS (see electron.vite.config.ts).
 *
 * Exposes a narrow API to the renderer via contextBridge as `window.electronAPI`. The renderer is
 * untrusted, so nothing here takes a file path: `saveFile` and `openFiles` ask the main process to
 * show a native dialog and do the I/O, and only file names and contents come back.
 */
import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  // Files — the user picks the path in a native dialog; the page never sees it
  saveFile: (request: unknown) => ipcRenderer.invoke('file:save', request),
  openFiles: (request: unknown) => ipcRenderer.invoke('file:open', request),

  // Server URL — the getter is sync (read at module load); a change needs the user's confirmation
  getServerUrl: () => ipcRenderer.sendSync('app:getServerUrl'),
  setServerUrl: (url: string) => ipcRenderer.invoke('app:setServerUrl', url),

  // DevTools
  toggleDevTools: () => ipcRenderer.invoke('app:toggleDevTools'),

  // Menu actions (main → renderer)
  onMenuAction: (callback: (action: string) => void) => {
    ipcRenderer.on('menu:action', (_event, action: string) => callback(action));
  },
});
