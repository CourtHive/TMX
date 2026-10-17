/**
 * Electron platform adapter.
 *
 * Communicates with the main process via the preload-injected `window.electronAPI`.
 * Falls back gracefully if preload bridge is unavailable.
 */
import type { PlatformAdapter, SaveFileRequest, OpenFilesRequest, OpenedFile } from './types';

/** Shape of the API exposed by the Electron preload script */
interface ElectronBridge {
  saveFile(request: SaveFileRequest): Promise<{ saved: boolean }>;
  openFiles(request: OpenFilesRequest): Promise<OpenedFile[] | undefined>;
  getServerUrl(): string;
  setServerUrl(url: string): Promise<{ saved: boolean }>;
  toggleDevTools(): Promise<void>;
  onMenuAction(callback: (action: string) => void): void;
}

function getBridge(): ElectronBridge | undefined {
  return (globalThis as any).electronAPI;
}

function buildBridgeMethods(bridge: ElectronBridge | undefined): Partial<PlatformAdapter> {
  if (!bridge) return {};

  return {
    saveFile: (request: SaveFileRequest) => bridge.saveFile(request),
    openFiles: (request: OpenFilesRequest) => bridge.openFiles(request),
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
    // No updater ships with the desktop build.
    canAutoUpdate: () => false,
    isDesktop: () => true,
    getDefaultServerUrl: () => bridge?.getServerUrl() || 'http://localhost:8383',
    ...bridgeMethods,
  };
}
