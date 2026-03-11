/**
 * Device capability detection.
 * Set once at initialization from navigator UA.
 */
import { platform } from 'platform';

export interface DeviceConfig {
  isMobile: boolean;
  isTouch: boolean;
  isMac: boolean;
  isWindows: boolean;
  isIDevice: boolean;
  isIpad: boolean;
  isStandalone: boolean;
  isElectron: boolean;
}

function detect(): DeviceConfig {
  const nav = typeof navigator !== 'undefined' ? navigator : undefined;
  const ua = nav?.userAgent ?? '';

  return {
    isMobile: /Mobi/.test(ua),
    isTouch: typeof window !== 'undefined' && 'ontouchstart' in window,
    isMac: /Macintosh/.test(ua),
    isWindows: /indows/.test(ua),
    isIDevice: /iphone|ipod|ipad/i.test(ua),
    isIpad: /iPad/i.test(ua),
    isStandalone: !!(nav && 'standalone' in nav && (nav as any).standalone),
    isElectron: platform.isDesktop(),
  };
}

let current: DeviceConfig | undefined;

export const deviceConfig = {
  get: (): Readonly<DeviceConfig> => {
    if (!current) current = detect();
    return current;
  },
  /** Re-detect (useful if called before DOM is ready, then again after) */
  refresh: () => {
    current = detect();
  },
} as const;
