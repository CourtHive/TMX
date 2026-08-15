import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

/**
 * Allocate a throwaway Electron `userData` directory.
 *
 * WHY THIS EXISTS. Electron persists `userData` (localStorage, IndexedDB,
 * `tmx-prefs.json`) in a fixed per-app location, so consecutive runs of this
 * suite share state. That silently disarmed a guard: the `nothing fails to load
 * from the app bundle` assertion caught `file:///i18n/manifest` on a cold
 * profile, then stopped catching it once an earlier run had cached the i18n
 * manifest in localStorage — the specs kept passing while the underlying defect
 * was reintroduced. Verified by reverting the `baseApi` fix and watching the
 * suite stay green.
 *
 * A fresh directory per launch makes each run a cold start, which is also the
 * state a real user's first launch is in — the one most worth testing. This is
 * architectural-standard A6 (test-environment state must be deterministic per
 * test) applied to a process-level cache rather than to `process.env`.
 */
export function freshUserDataDir(): { path: string; cleanup: () => void } {
  const path = mkdtempSync(join(tmpdir(), 'tmx-electron-e2e-'));
  return {
    path,
    cleanup: () => {
      try {
        rmSync(path, { recursive: true, force: true });
      } catch {
        // Best effort — a leftover temp dir is harmless, and throwing here would
        // mask the real assertion failure that led to teardown.
      }
    },
  };
}
