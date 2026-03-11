/**
 * Web (browser) platform adapter.
 *
 * Default implementation — no native capabilities.
 * Server URL resolves from Vite env or window.location.origin.
 */
import type { PlatformAdapter } from './types';

export function createWebPlatform(): PlatformAdapter {
  return {
    type: 'web',
    canAccessFileSystem: () => false,
    canAutoUpdate: () => false,
    isDesktop: () => false,
    getDefaultServerUrl: () => {
      // Vite replaces process.env.SERVER at compile time via vite-plugin-environment
      return process.env.SERVER || window.location.origin;
    },
  };
}
