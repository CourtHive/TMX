import { launchPackagedOverCdp, readFuseWire, type PackagedApp } from './helpers/packagedApp';
import { findPackagedExecutable } from './helpers/packagedExecutable';
import { expect, test, type Page } from '@playwright/test';
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
 * CI runs `electron-builder --dir` AFTER the smoke suite, so in CI this spec skips; the packaging
 * step itself is the CI gate there.
 *
 * The shipped app carries Electron fuses that disable the Node inspector, so it is driven over the
 * DevTools protocol (helpers/packagedApp.ts), and the fuse wire itself is asserted below.
 */

const executablePath = findPackagedExecutable();

test.describe('packaged application', () => {
  test.skip(!executablePath, 'no package in release/ — run `pnpm electron:package` first');

  let packaged: PackagedApp;
  let window: Page;
  let userData: { path: string; cleanup: () => void };
  const failedFileRequests: string[] = [];

  test.beforeAll(async () => {
    userData = freshUserDataDir();
    packaged = await launchPackagedOverCdp(executablePath!, userData.path);
    window = packaged.page;
    // The renderer is served from app://tmx: a missing asset is a 404 RESPONSE from the protocol
    // handler, not a failed request, so both are tracked. The page may have loaded before CDP
    // attached, so reload once the listeners are in place.
    window.on('requestfailed', (request) => {
      const url = request.url();
      if (url.startsWith('app://')) failedFileRequests.push(`${url} (${request.failure()?.errorText})`);
    });
    window.on('response', (response) => {
      if (response.url().startsWith('app://') && response.status() >= 400) {
        failedFileRequests.push(`${response.url()} (HTTP ${response.status()})`);
      }
    });
    await window.reload();
  });

  test.afterAll(async () => {
    await packaged?.close();
    userData?.cleanup();
  });

  test('ships with the security fuses set', () => {
    // FuseV1Options order: RunAsNode, EnableCookieEncryption, EnableNodeOptionsEnvironmentVariable,
    // EnableNodeCliInspectArguments, EnableEmbeddedAsarIntegrityValidation, OnlyLoadAppFromAsar,
    // LoadBrowserProcessSpecificV8Snapshot, GrantFileProtocolExtraPrivileges, …
    const wire = readFuseWire(executablePath!);
    expect(wire.slice(0, 6), 'fuses 0–5').toBe('010011');
    expect(wire[7], 'GrantFileProtocolExtraPrivileges').toBe('0');
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
    const packaged = await launchPackagedOverCdp(executablePath!, userData.path, {
      ...process.env,
      ELECTRON_RENDERER_URL: 'https://example.com/',
    });
    try {
      await packaged.page.waitForLoadState('domcontentloaded');
      expect(packaged.page.url()).toBe('app://tmx/index.html');
    } finally {
      await packaged.close();
      userData.cleanup();
    }
  });
});
