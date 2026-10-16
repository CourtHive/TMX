import { ElectronApplication, Page, _electron as electron, expect, test } from '@playwright/test';
import { findPackagedExecutable } from './helpers/packagedExecutable';
import { freshUserDataDir } from './helpers/userDataDir';

/**
 * Smoke test against the REAL packaged application — the `.app` / `.exe` /
 * AppImage that electron-builder produces and that a tournament director
 * installs — rather than against `dist-electron/` in the working tree.
 *
 * Why this is separate from `app-launch.spec.ts`: the other specs run the build
 * OUTPUT, which is not the same artifact as the PACKAGE. Between them sit
 * electron-builder's `files` globs, asar packing, and native-dependency rebuild
 * — a whole layer with its own failure mode ("works from source, ships an app
 * with no renderer"). The classic symptom is a packaged app whose window opens
 * on an empty asar.
 *
 * SKIPPED unless a package exists, because `pnpm electron:package` takes minutes
 * and downloads an Electron distribution. Run it explicitly:
 *
 *     pnpm electron:package && pnpm test:electron
 *
 * CI runs `electron-builder --dir`, which exercises the same packaging pipeline
 * without producing installers, so this spec runs there too.
 */

const executablePath = findPackagedExecutable();

test.describe('packaged application', () => {
  test.skip(!executablePath, 'no package in release/ — run `pnpm electron:package` first');

  let app: ElectronApplication;
  let window: Page;
  let userData: { path: string; cleanup: () => void };
  const failedFileRequests: string[] = [];

  test.beforeAll(async () => {
    userData = freshUserDataDir();
    app = await electron.launch({
      executablePath,
      args: [`--user-data-dir=${userData.path}`],
    });
    window = await app.firstWindow();
    // The renderer is served from app://tmx: a missing asset is a 404 RESPONSE from the protocol
    // handler, not a failed request, so both are tracked.
    window.on('requestfailed', (request) => {
      const url = request.url();
      if (url.startsWith('app://')) failedFileRequests.push(`${url} (${request.failure()?.errorText})`);
    });
    window.on('response', (response) => {
      if (response.url().startsWith('app://') && response.status() >= 400) {
        failedFileRequests.push(`${response.url()} (HTTP ${response.status()})`);
      }
    });
  });

  test.afterAll(async () => {
    await app?.close();
    userData?.cleanup();
  });

  test('boots TMX from inside the asar', async () => {
    await window.waitForFunction(() => typeof (globalThis as any).dev !== 'undefined', null, { timeout: 40_000 });

    const rendered = await window.evaluate(() => document.getElementById('root')?.childElementCount ?? 0);
    expect(rendered, 'packaged app rendered an empty #root').toBeGreaterThan(0);
  });

  test('ships the preload bridge', async () => {
    // `files` globs in electron-builder.json5 must include `dist-electron/**/*`;
    // dropping it packages a working window with no native capabilities.
    const bridgeMethods = await window.evaluate(() => {
      const api = (globalThis as any).electronAPI;
      return api ? Object.keys(api).length : 0;
    });
    expect(bridgeMethods, 'preload missing from the package').toBeGreaterThan(0);
  });

  test('loads every bundled asset from the package', async () => {
    await window.waitForTimeout(2_500);
    expect(failedFileRequests, `packaged app failed to load:\n  ${failedFileRequests.join('\n  ')}`).toEqual([]);
  });
});

test.describe('packaged application ignores the dev-server override', () => {
  test.skip(!executablePath, 'no package in release/ — run `pnpm electron:package` first');

  test('ELECTRON_RENDERER_URL cannot point a packaged app at another page', async () => {
    const userData = freshUserDataDir();
    const app = await electron.launch({
      executablePath,
      args: [`--user-data-dir=${userData.path}`],
      env: { ...process.env, ELECTRON_RENDERER_URL: 'https://example.com/' },
    });
    try {
      const window = await app.firstWindow();
      await window.waitForLoadState('domcontentloaded');
      expect(window.url()).toBe('app://tmx/index.html');
    } finally {
      await app.close();
      userData.cleanup();
    }
  });
});
