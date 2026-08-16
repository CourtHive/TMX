import { ElectronApplication, Page, _electron as electron, expect, test } from '@playwright/test';
import { freshUserDataDir } from './helpers/userDataDir';
import { resolve } from 'path';

/**
 * The load-bearing smoke test: does the packaged desktop app actually start?
 *
 * Asserts progressively deeper layers so a failure localises itself:
 *   1. the Electron process starts at all           (main entry is loadable)
 *   2. a window opens                               (createWindow ran)
 *   3. the renderer's own assets loaded             (base / file:// resolution)
 *   4. TMX itself booted                            (app code ran, not just HTML)
 */

// `import.meta.dirname` rather than `__dirname`: package.json declares
// `"type": "module"`, so these specs are loaded as ESM.
const repoRoot = resolve(import.meta.dirname, '../..');
const MAIN_ENTRY = resolve(repoRoot, 'dist-electron/main/main.js');

let app: ElectronApplication;
let window: Page;
const pageErrors: string[] = [];
const failedFileRequests: string[] = [];

let userData: { path: string; cleanup: () => void };

test.beforeAll(async () => {
  userData = freshUserDataDir();
  app = await electron.launch({
    // `--user-data-dir` forces a cold profile — see helpers/userDataDir.ts for
    // the guard this restores.
    args: [MAIN_ENTRY, `--user-data-dir=${userData.path}`],
    // A packaged app has no ELECTRON_RENDERER_URL, so main.ts takes the
    // `loadFile()` branch — the production path we actually ship. Clearing it
    // explicitly stops an inherited value from silently testing the dev server
    // instead (which would defeat the whole suite).
    env: { ...process.env, ELECTRON_RENDERER_URL: '', NODE_ENV: 'production' },
  });

  window = await app.firstWindow();

  window.on('pageerror', (error) => pageErrors.push(error.message));

  // Track failures against the app's OWN origin. Requests to an http(s) API host
  // are expected to fail in this suite — there is no CFS running — so asserting
  // on console text would either be too noisy to keep or too vague to trust.
  // A failed `file://` request is unambiguous: either a bundled asset is missing,
  // or code built an absolute URL against the file origin (the `/fonts/*` and
  // `file:///i18n/manifest` defects both presented exactly this way).
  window.on('requestfailed', (request) => {
    const url = request.url();
    if (url.startsWith('file://')) failedFileRequests.push(`${url} (${request.failure()?.errorText})`);
  });
});

test.afterAll(async () => {
  await app?.close();
  userData?.cleanup();
});

test.describe('electron app launch', () => {
  test('opens a window with the TMX title', async () => {
    expect(await window.title()).toContain('TMX');
  });

  test('main process reports the expected app identity', async () => {
    const identity = await app.evaluate(async ({ app: electronApp }) => ({
      name: electronApp.getName(),
      hasUserData: Boolean(electronApp.getPath('userData')),
    }));

    expect(identity.hasUserData).toBe(true);
    expect(identity.name).toBeTruthy();
  });

  test('renderer assets resolve under the file:// protocol', async () => {
    // The blank-window failure mode: index.html parses fine, so a title check
    // still passes, but every `/assets/*` request 404s off the filesystem root.
    // Proving a stylesheet applied is proving the asset graph actually loaded.
    await window.waitForLoadState('domcontentloaded');

    const styleSheetCount = await window.evaluate(() => document.styleSheets.length);
    expect(styleSheetCount, 'no stylesheets loaded — assets did not resolve').toBeGreaterThan(0);

    const scriptCount = await window.evaluate(
      () => document.querySelectorAll('script[src], link[rel="modulepreload"]').length,
    );
    expect(scriptCount).toBeGreaterThan(0);
  });

  test('TMX application code boots in the renderer', async () => {
    // `globalThis.dev` is installed by TMX's own startup path, so its presence
    // proves the bundle executed — not merely that HTML was served. This is the
    // same readiness signal the web journeys use (`e2e/helpers/dev-bridge.ts`).
    await window.waitForFunction(() => typeof (globalThis as any).dev !== 'undefined', null, { timeout: 30_000 });

    const rootPopulated = await window.evaluate(() => {
      const root = document.getElementById('root');
      return Boolean(root && root.childElementCount > 0);
    });
    expect(rootPopulated, '#root is empty — TMX rendered nothing').toBe(true);
  });

  test('renderer boots without uncaught errors', async () => {
    // Runs after the boot test above so the app has had a full startup to fail in.
    expect(pageErrors, `uncaught renderer exceptions: ${pageErrors.join(' | ')}`).toEqual([]);
  });

  test('nothing fails to load from the app bundle', async () => {
    // Give late startup work (font catalog, i18n) a chance to issue its requests
    // before sampling — these fire after `dev` is installed, not before it.
    await window.waitForTimeout(2_000);

    expect(
      failedFileRequests,
      `requests failed against the file:// origin:\n  ${failedFileRequests.join('\n  ')}`,
    ).toEqual([]);
  });
});
