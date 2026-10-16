/**
 * Platform detection and singleton accessor.
 *
 * Auto-detects web vs Electron at startup. Application code imports
 * `platform` and uses it without caring which environment is active.
 */
import { createElectronPlatform } from './electron';
import type { PlatformAdapter } from './types';
import { createWebPlatform } from './web';

export type { PlatformAdapter, PlatformType, SaveFileRequest, OpenFilesRequest, OpenedFile } from './types';

function detectPlatform(): PlatformAdapter {
  // The Electron preload sets globalThis.electronAPI
  if ((globalThis as any).electronAPI) {
    return createElectronPlatform();
  }
  return createWebPlatform();
}

/** Singleton platform adapter — detected once at module load */
export const platform: PlatformAdapter = detectPlatform();
