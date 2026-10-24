/**
 * Ask the browser to keep TMX's storage (IndexedDB, localStorage) instead of treating it as
 * best-effort. Without this, Chromium may evict an origin's data under disk pressure — including a
 * tournament held offline, whose local copy is the only one (`offlineCustody.ts`).
 *
 * The browser may decline (it weighs engagement, installation and bookmarks); nothing depends on the
 * answer, so it is asked once at startup and never awaited.
 */
export function requestPersistentStorage(): void {
  try {
    void globalThis.navigator?.storage?.persist?.().catch(() => undefined);
  } catch {
    // An environment without the Storage API; best-effort is the only option there.
  }
}
