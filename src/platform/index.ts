/**
 * Platform detection and singleton accessor.
 *
 * Auto-detects web vs Electron at startup. Application code imports
 * `platform` and uses it without caring which environment is active.
 */
import { createElectronPlatform } from './electron';
import type { PlatformAdapter } from './types';
import { createWebPlatform } from './web';

export type { PlatformAdapter, PlatformType, SaveDialogOptions, OpenDialogOptions } from './types';

function detectPlatform(): PlatformAdapter {
  // Electron preload scripts set window.electronAPI
  if (typeof window !== 'undefined' && (window as any).electronAPI) {
    return createElectronPlatform();
  }
  return createWebPlatform();
}

/** Singleton platform adapter — detected once at module load */
export const platform: PlatformAdapter = detectPlatform();
