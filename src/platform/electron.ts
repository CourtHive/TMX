/**
 * Electron platform adapter.
 *
 * Communicates with the main process via the preload-injected `window.electronAPI`.
 * Falls back gracefully if preload bridge is unavailable.
 */
import type { PlatformAdapter, SaveDialogOptions, OpenDialogOptions } from './types';

/** Shape of the API exposed by the Electron preload script */
interface ElectronBridge {
  showSaveDialog(options: SaveDialogOptions): Promise<string | undefined>;
  showOpenDialog(options: OpenDialogOptions): Promise<string[] | undefined>;
  readFile(filePath: string): Promise<Uint8Array>;
  writeFile(filePath: string, data: Uint8Array): Promise<void>;
  getAppDataPath(): string;
  getServerUrl(): string;
  setServerUrl(url: string): Promise<void>;
  toggleDevTools(): Promise<void>;
  onMenuAction(callback: (action: string) => void): void;
}

function getBridge(): ElectronBridge | undefined {
  return (window as any).electronAPI;
}

export function createElectronPlatform(): PlatformAdapter {
  const bridge = getBridge();

  return {
    type: 'electron',
    canAccessFileSystem: () => !!bridge,
    canAutoUpdate: () => true,
    isDesktop: () => true,

    getDefaultServerUrl: () => {
      // Electron app may have a stored server URL preference
      return bridge?.getServerUrl() || 'http://localhost:8383';
    },

    showSaveDialog: bridge
      ? (options: SaveDialogOptions) => bridge.showSaveDialog(options)
      : undefined,

    showOpenDialog: bridge
      ? (options: OpenDialogOptions) => bridge.showOpenDialog(options)
      : undefined,

    readFile: bridge
      ? (filePath: string) => bridge.readFile(filePath)
      : undefined,

    writeFile: bridge
      ? (filePath: string, data: Uint8Array) => bridge.writeFile(filePath, data)
      : undefined,

    getAppDataPath: bridge
      ? () => bridge.getAppDataPath()
      : undefined,

    setServerUrl: bridge
      ? (url: string) => bridge.setServerUrl(url)
      : undefined,

    toggleDevTools: bridge
      ? () => bridge.toggleDevTools()
      : undefined,

    onMenuAction: bridge
      ? (callback: (action: string) => void) => bridge.onMenuAction(callback)
      : undefined,
  };
}
