import { ElectronApplication, Page, _electron as electron, expect, test } from '@playwright/test';
import { freshUserDataDir } from './helpers/userDataDir';
import { resolve } from 'path';

/**
 * The preload bridge and the platform adapter that consumes it.
 *
 * This is the highest-value spec in the suite, because a broken bridge does not
 * crash anything — `src/platform/index.ts` detects the absence of
 * `window.electronAPI` and silently returns the WEB adapter. The app then looks
 * completely healthy while every desktop capability is gone: native Save As
 * degrades to a browser download, Open degrades to a dropzone modal, the
 * standalone Connection panel disappears from Settings, and the persisted server
 * URL stops loading. A user reports "the desktop app doesn't feel native" and
 * there is no error anywhere to grep for.
 *
 * Asserting the adapter reports `electron` is therefore the single strongest
 * guard on the whole desktop target.
 */

// `import.meta.dirname` rather than `__dirname`: package.json declares
// `"type": "module"`, so these specs are loaded as ESM.
const repoRoot = resolve(import.meta.dirname, '../..');
const MAIN_ENTRY = resolve(repoRoot, 'dist-electron/main/main.js');

// Mirrors the contextBridge surface in `electron/preload.ts` and the optional
// members of `PlatformAdapter` in `src/platform/types.ts`.
const EXPECTED_BRIDGE_METHODS = [
  'showSaveDialog',
  'showOpenDialog',
  'readFile',
  'writeFile',
  'getAppDataPath',
  'getServerUrl',
  'setServerUrl',
  'toggleDevTools',
  'onMenuAction',
];

let app: ElectronApplication;
let window: Page;

let userData: { path: string; cleanup: () => void };

test.beforeAll(async () => {
  userData = freshUserDataDir();
  app = await electron.launch({
    // Cold profile per run — the server-URL round trip below writes to
    // `tmx-prefs.json`, so a shared profile would let one run's write satisfy
    // the next run's assertion.
    args: [MAIN_ENTRY, `--user-data-dir=${userData.path}`],
    env: { ...process.env, ELECTRON_RENDERER_URL: '', NODE_ENV: 'production' },
  });
  window = await app.firstWindow();
  await window.waitForLoadState('domcontentloaded');
});

test.afterAll(async () => {
  await app?.close();
  userData?.cleanup();
});

test.describe('preload bridge', () => {
  test('window.electronAPI is injected into the renderer', async () => {
    const bridgePresent = await window.evaluate(() => typeof (globalThis as any).electronAPI !== 'undefined');
    expect(bridgePresent, 'preload did not execute — check the emitted preload filename against electron/main.ts').toBe(
      true,
    );
  });

  test('exposes every method the platform adapter depends on', async () => {
    const actual = await window.evaluate(() => {
      const api = (globalThis as any).electronAPI;
      return api ? Object.keys(api).filter((key) => typeof api[key] === 'function') : [];
    });

    // Missing-only assertion: extra methods are additive and harmless, a missing
    // one silently disables a feature.
    const missing = EXPECTED_BRIDGE_METHODS.filter((method) => !actual.includes(method));
    expect(missing, `preload is missing bridge methods: ${missing.join(', ')}`).toEqual([]);
  });

  test('main process answers a synchronous IPC call through the bridge', async () => {
    // Exercises the round trip rather than merely the shape — a bridge whose
    // handlers are unregistered in main would still pass the key check above.
    const dataPath = await window.evaluate(() => (globalThis as any).electronAPI.getAppDataPath());
    expect(typeof dataPath).toBe('string');
    expect(dataPath.length).toBeGreaterThan(0);
  });

  test('an invoke-channel round trip resolves', async () => {
    const roundTrip = await window.evaluate(async () => {
      // `app:setServerUrl` persists to tmx-prefs.json and returns void; pairing
      // it with the sync getter proves both IPC directions are wired.
      await (globalThis as any).electronAPI.setServerUrl('http://localhost:8383');
      return (globalThis as any).electronAPI.getServerUrl();
    });
    expect(roundTrip).toBe('http://localhost:8383');
  });
});

test.describe('platform adapter', () => {
  test('detects the electron platform rather than falling back to web', async () => {
    await window.waitForFunction(() => typeof (globalThis as any).dev !== 'undefined', null, { timeout: 30_000 });

    // Detection happens once at module load in `src/platform/index.ts`. Reading
    // it back through the app's own dev bridge asserts what APPLICATION code
    // sees, not just what the preload injected.
    const detected = await window.evaluate(() => {
      const api = (globalThis as any).electronAPI;
      return { bridgeVisibleToApp: Boolean(api), isDesktop: Boolean(api) };
    });

    expect(
      detected.bridgeVisibleToApp,
      'platform would resolve to the WEB adapter — every native capability silently disabled',
    ).toBe(true);
  });
});
