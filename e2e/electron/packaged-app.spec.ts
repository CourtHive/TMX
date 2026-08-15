import { ElectronApplication, Page, _electron as electron, expect, test } from '@playwright/test';
import { freshUserDataDir } from './helpers/userDataDir';
import { existsSync, readdirSync } from 'fs';
import { resolve } from 'path';

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

const repoRoot = resolve(import.meta.dirname, '../..');
const RELEASE_DIR = resolve(repoRoot, 'release');

/**
 * Locate the packaged executable for the current platform. Returns undefined
 * when no package has been built, which switches the whole suite to skipped.
 */
function findPackagedExecutable(): string | undefined {
  if (!existsSync(RELEASE_DIR)) return undefined;

  const entries = readdirSync(RELEASE_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);

  for (const dir of entries) {
    if (process.platform === 'darwin') {
      const appDir = resolve(RELEASE_DIR, dir);
      const app = readdirSync(appDir, { withFileTypes: true }).find((e) => e.name.endsWith('.app'));
      if (app) {
        const binary = resolve(appDir, app.name, 'Contents/MacOS', app.name.replace(/\.app$/, ''));
        if (existsSync(binary)) return binary;
      }
    } else if (process.platform === 'win32') {
      const binary = resolve(RELEASE_DIR, dir, 'TMX.exe');
      if (existsSync(binary)) return binary;
    } else {
      const binary = resolve(RELEASE_DIR, dir, 'tmx');
      if (existsSync(binary)) return binary;
    }
  }
  return undefined;
}

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
    window.on('requestfailed', (request) => {
      const url = request.url();
      if (url.startsWith('file://')) failedFileRequests.push(`${url} (${request.failure()?.errorText})`);
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
