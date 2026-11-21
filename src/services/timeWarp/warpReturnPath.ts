import { clearDemoOverlay, setDemoOverlay } from 'services/demoMode/demoState';
import { WARP_ID_PREFIX, WARP_RETURN_KEY } from './warpState';

/** Only return address and prior Demo posture survive reload. No sandbox tournament is persisted. */
export function storeWarpReturn(path: string, overlay?: any): void {
  try {
    globalThis.sessionStorage?.setItem(WARP_RETURN_KEY, JSON.stringify({ v: 1, path, overlay }));
  } catch (error) {
    console.warn('[timeWarp] return location could not be stored', error);
  }
}

export function clearWarpReturn(): void {
  try {
    globalThis.sessionStorage?.removeItem(WARP_RETURN_KEY);
  } catch (error) {
    console.warn('[timeWarp] return location could not be cleared', error);
  }
}

export function recoverWarpReturnPath(): string | undefined {
  if (!globalThis.location?.hash.includes(`/tournament/${WARP_ID_PREFIX}`)) return undefined;
  let path: string | undefined;
  try {
    const raw = globalThis.sessionStorage?.getItem(WARP_RETURN_KEY);
    if (raw?.startsWith('/'))
      path = raw; // earlier local builds stored only the path
    else if (raw) {
      const marker = JSON.parse(raw);
      if (marker.v === 1) {
        path = marker.path;
        if (marker.overlay) setDemoOverlay(marker.overlay);
        else clearDemoOverlay();
      }
    }
  } catch (error) {
    console.warn('[timeWarp] return location could not be read', error);
  }
  clearWarpReturn();
  return path?.startsWith('/tournament/') && !path.includes(WARP_ID_PREFIX) ? path : '/tournaments';
}
