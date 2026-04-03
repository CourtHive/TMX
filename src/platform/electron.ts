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

function buildBridgeMethods(bridge: ElectronBridge | undefined): Partial<PlatformAdapter> {
  if (!bridge) return {};

  return {
    showSaveDialog: (options: SaveDialogOptions) => bridge.showSaveDialog(options),
    showOpenDialog: (options: OpenDialogOptions) => bridge.showOpenDialog(options),
    readFile: (filePath: string) => bridge.readFile(filePath),
    writeFile: (filePath: string, data: Uint8Array) => bridge.writeFile(filePath, data),
    getAppDataPath: () => bridge.getAppDataPath(),
    setServerUrl: (url: string) => bridge.setServerUrl(url),
    toggleDevTools: () => bridge.toggleDevTools(),
    onMenuAction: (callback: (action: string) => void) => bridge.onMenuAction(callback),
  };
}

export function createElectronPlatform(): PlatformAdapter {
  const bridge = getBridge();
  const bridgeMethods = buildBridgeMethods(bridge);

  return {
    type: 'electron',
    canAccessFileSystem: () => !!bridge,
    canAutoUpdate: () => true,
    isDesktop: () => true,
    getDefaultServerUrl: () => bridge?.getServerUrl() || 'http://localhost:8383',
    ...bridgeMethods,
  };
}
