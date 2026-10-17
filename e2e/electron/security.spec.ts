import { ElectronApplication, Page, _electron as electron, expect, test } from '@playwright/test';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { findPackagedExecutable } from './helpers/packagedExecutable';
import { freshUserDataDir } from './helpers/userDataDir';
import { join, resolve } from 'path';
import { tmpdir } from 'os';

/**
 * The renderer is untrusted (Mentat/planning/TMX_ELECTRON_SECURITY.md).
 *
 * TMX renders server-delivered strings with innerHTML at hundreds of sites, so script in the page
 * must be assumed reachable. These journeys run that script — through `window.evaluate`, i.e. with
 * exactly the authority an injected payload would have — and assert what it can NOT do: choose a
 * file path, navigate the privileged window away, open a window that keeps the bridge, run inline
 * script, use a permission TMX never asks for, or silently repoint the persisted server.
 *
 * Native dialogs are replaced in the MAIN process (`app.evaluate`) by stubs that record their
 * arguments and answer as a user would. Each test installs the stubs it needs.
 */

const repoRoot = resolve(import.meta.dirname, '../..');
const MAIN_ENTRY = resolve(repoRoot, 'dist-electron/main/main.js');
// TMX_E2E_PACKAGED=1 runs these journeys against the packaged app in release/ instead, where
// `app.isPackaged` is true and the renderer loads from inside the asar. They stub dialogs in the
// main process, which needs the Node inspector the shipped fuses disable, so build that package with
//   electron-builder --config electron-builder.json5 --dir -c.electronFuses.enableNodeCliInspectArguments=true
// (packaged-app.spec.ts covers the shipped, fully fused artifact over CDP).
const packagedExecutable = process.env.TMX_E2E_PACKAGED ? findPackagedExecutable() : undefined;

let app: ElectronApplication;
let window: Page;
let userData: { path: string; cleanup: () => void };
let scratch: string;
/** Main-process console output from the boot itself, before any test injects anything. */
let bootConsole: string[] = [];

const api = (page: Page, script: string) =>
  page.evaluate(`(async () => { const api = globalThis.electronAPI; ${script} })()`) as Promise<any>;

async function windowCount(): Promise<number> {
  return app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().length);
}

async function stubDialogs(answers: { savePath?: string; openPaths?: string[]; confirm?: boolean }) {
  await app.evaluate(({ dialog }, a) => {
    const calls: any[] = [];
    (globalThis as any).__dialogCalls = calls;
    (dialog as any).showSaveDialog = async (_w: any, options: any) => {
      calls.push({ kind: 'save', options });
      return a.savePath ? { canceled: false, filePath: a.savePath } : { canceled: true };
    };
    (dialog as any).showOpenDialog = async (_w: any, options: any) => {
      calls.push({ kind: 'open', options });
      return a.openPaths ? { canceled: false, filePaths: a.openPaths } : { canceled: true, filePaths: [] };
    };
    (dialog as any).showMessageBox = async (_w: any, options: any) => {
      calls.push({ kind: 'message', options });
      return { response: a.confirm ? 0 : 1, checkboxChecked: false };
    };
  }, answers);
}

const withoutHash = (url: string) => url.split('#')[0];

const dialogCalls = (): Promise<any[]> => app.evaluate(() => (globalThis as any).__dialogCalls ?? []);

/** Waits for the app to be running again after main reloads the window (a confirmed server change). */
async function untilReloaded(action: () => Promise<any>): Promise<any> {
  const reloaded = window.waitForEvent('load');
  const result = await action();
  await reloaded;
  await window.waitForFunction(() => typeof (globalThis as any).dev !== 'undefined', null, { timeout: 30_000 });
  return result;
}

/** Console messages the main process saw, captured from before the boot under test. */
const mainConsole = (): Promise<string[]> => app.evaluate(() => (globalThis as any).__console ?? []);

test.beforeAll(async () => {
  userData = freshUserDataDir();
  scratch = mkdtempSync(join(tmpdir(), 'tmx-electron-security-'));
  if (process.env.TMX_E2E_PACKAGED && !packagedExecutable)
    throw new Error('TMX_E2E_PACKAGED set but release/ has no app');
  app = packagedExecutable
    ? await electron.launch({ executablePath: packagedExecutable, args: [`--user-data-dir=${userData.path}`] })
    : await electron.launch({
        args: [MAIN_ENTRY, `--user-data-dir=${userData.path}`],
        env: { ...process.env, ELECTRON_RENDERER_URL: '', NODE_ENV: 'production' },
      });
  window = await app.firstWindow();
  // Capture console output in MAIN, then reload, so the CSP check sees the whole boot — a listener
  // attached after firstWindow() would miss violations logged while the document parses.
  await app.evaluate(({ BrowserWindow }) => {
    const log: string[] = ((globalThis as any).__console = []);
    BrowserWindow.getAllWindows()[0].webContents.on('console-message', (...args: any[]) => {
      log.push(String(args[0]?.message ?? args[2] ?? ''));
    });
  });
  await window.reload();
  await window.waitForFunction(() => typeof (globalThis as any).dev !== 'undefined', null, { timeout: 30_000 });
  await window.waitForTimeout(1500); // late startup requests (fonts, i18n)
  bootConsole = await mainConsole();
});

test.afterAll(async () => {
  await app?.close();
  userData?.cleanup();
  rmSync(scratch, { recursive: true, force: true });
});

test.describe('W1 — the page never chooses a file path', () => {
  test('a path supplied by the page is not written', async () => {
    const target = join(scratch, 'planted.txt');
    await api(
      window,
      `try { await api.writeFile?.(${JSON.stringify(target)}, new Uint8Array([111, 119, 110])); } catch {}`,
    );
    expect(existsSync(target), 'the renderer wrote a file at a path of its own choosing').toBe(false);
  });

  test('a file the user did not pick in a dialog cannot be read', async () => {
    const secret = join(scratch, 'secret.txt');
    writeFileSync(secret, 'operator secret');
    const leaked = await api(
      window,
      `try { const b = await api.readFile?.(${JSON.stringify(secret)}); return b ? new TextDecoder().decode(b) : null; } catch { return null; }`,
    );
    expect(leaked, 'the renderer read a file it named itself').toBeNull();
  });

  test('page script cannot fetch a local file', async () => {
    const secret = join(scratch, 'fetched.txt');
    writeFileSync(secret, 'operator secret');
    const outcome = await window.evaluate(async (url) => {
      try {
        return 'READ: ' + (await (await fetch(url)).text());
      } catch {
        return 'blocked';
      }
    }, `file://${secret}`);
    expect(outcome).toBe('blocked');
  });

  test('a planted local .js file cannot be run as a script', async () => {
    const planted = join(scratch, 'planted.js');
    writeFileSync(planted, 'globalThis.__localScript = true;');
    const ran = await window.evaluate(
      (url) =>
        new Promise<boolean>((done) => {
          const script = document.createElement('script');
          script.src = url;
          script.onload = script.onerror = () => done(Boolean((globalThis as any).__localScript));
          document.head.appendChild(script);
        }),
      `file://${planted}`,
    );
    expect(ran).toBe(false);
  });

  test('a local file cannot be framed', async () => {
    const secret = join(scratch, 'framed.txt');
    writeFileSync(secret, 'operator secret');
    const framed = await window.evaluate(
      (url) =>
        new Promise<string>((done) => {
          const frame = document.createElement('iframe');
          frame.src = url;
          frame.onload = () => {
            try {
              done(frame.contentDocument?.body?.textContent ?? 'opaque');
            } catch {
              done('opaque');
            }
          };
          document.body.appendChild(frame);
          setTimeout(() => done('not loaded'), 2000);
        }),
      `file://${secret}`,
    );
    expect(framed).not.toContain('operator secret');
  });

  test('the bridge exposes no path-taking file or dialog methods', async () => {
    const keys: string[] = await api(window, `return Object.keys(api);`);
    for (const removed of ['readFile', 'writeFile', 'showSaveDialog', 'showOpenDialog', 'getAppDataPath']) {
      expect(keys, `bridge still exposes ${removed}`).not.toContain(removed);
    }
  });

  test('saveFile writes to the path the user picked, offering only a bare file name', async () => {
    const chosen = join(scratch, 'export.codes.json');
    await stubDialogs({ savePath: chosen });
    const result = await api(
      window,
      `return api.saveFile({ title: 'Save', defaultName: '../../../Library/LaunchAgents/x.json',
        filters: [{ name: 'JSON', extensions: ['json'] }], data: new TextEncoder().encode('{"ok":true}') });`,
    );
    expect(result).toEqual({ saved: true });
    expect(readFileSync(chosen, 'utf8')).toBe('{"ok":true}');
    const [call] = await dialogCalls();
    expect(call.options.defaultPath).toBe('x.json');
  });

  test('saveFile never offers or writes an executable name the page chose', async () => {
    const typed = join(scratch, 'evil.command');
    await stubDialogs({ savePath: typed });
    const result = await api(
      window,
      `return api.saveFile({ defaultName: 'Update.bat', filters: [{ name: 'JSON', extensions: ['json'] }],
        data: new TextEncoder().encode('{}') });`,
    );
    expect(result).toEqual({ saved: true });
    const [call] = await dialogCalls();
    expect(call.options.defaultPath).toBe('Update.bat.json');
    expect(existsSync(typed)).toBe(false);
    expect(readFileSync(`${typed}.json`, 'utf8')).toBe('{}');
  });

  test('openFiles refuses a picked file of another type', async () => {
    const picked = join(scratch, 'notes.txt');
    writeFileSync(picked, 'not json');
    await stubDialogs({ openPaths: [picked] });
    const outcome = await api(
      window,
      `try { await api.openFiles({ filters: [{ name: 'JSON', extensions: ['json'] }] }); return 'read'; }
       catch { return 'refused'; }`,
    );
    expect(outcome).toBe('refused');
  });

  test('saveFile refuses an extension outside the allow-list without opening a dialog', async () => {
    await stubDialogs({ savePath: join(scratch, 'evil.sh') });
    const result = await api(
      window,
      `try { return await api.saveFile({ defaultName: 'evil.sh', filters: [{ name: 'x', extensions: ['sh'] }],
        data: new Uint8Array([1]) }); } catch { return 'refused'; }`,
    );
    expect(result).toBe('refused');
    expect(await dialogCalls()).toEqual([]);
    expect(existsSync(join(scratch, 'evil.sh'))).toBe(false);
  });

  test('openFiles returns the name and contents of each file the user picked, never a path', async () => {
    const picked = join(scratch, 'picked.json');
    writeFileSync(picked, '{"tournamentId":"t1"}');
    await stubDialogs({ openPaths: [picked] });
    const files = await api(
      window,
      `const files = await api.openFiles({ filters: [{ name: 'JSON', extensions: ['json'] }], multiple: true });
       return files.map((f) => ({ name: f.name, text: new TextDecoder().decode(f.data), keys: Object.keys(f).sort() }));`,
    );
    expect(files).toEqual([{ name: 'picked.json', text: '{"tournamentId":"t1"}', keys: ['data', 'name'] }]);
  });

  test('a cancelled open dialog returns undefined', async () => {
    await stubDialogs({});
    const files = await api(window, `return api.openFiles({ filters: [{ name: 'JSON', extensions: ['json'] }] });`);
    expect(files).toBeUndefined();
  });
});

test.describe('W2 — sandboxed preload', () => {
  test('the main window runs with sandbox enabled', async () => {
    const sandbox = await app.evaluate(
      // Present at runtime, absent from Electron 44's type definitions.
      ({ BrowserWindow }) => (BrowserWindow.getAllWindows()[0].webContents as any).getLastWebPreferences()?.sandbox,
    );
    expect(sandbox).toBe(true);
  });
});

test.describe('W3 — the privileged window stays on the app', () => {
  test.beforeEach(async () => {
    await app.evaluate(({ shell }) => {
      const opened: string[] = [];
      (globalThis as any).__opened = opened;
      (shell as any).openExternal = async (url: string) => {
        opened.push(url);
      };
    });
  });
  const opened = (): Promise<string[]> => app.evaluate(() => (globalThis as any).__opened ?? []);

  test('window.open of a CourtHive https URL opens no Electron window; the system browser gets it', async () => {
    const count = await windowCount();
    await window.evaluate(() => globalThis.open('https://courthive.com/public', '_blank'));
    await window.waitForTimeout(1000);
    expect(await windowCount()).toBe(count);
    expect(await opened()).toEqual(['https://courthive.com/public']);
  });

  test('an https link to any other host opens only after the user confirms it', async () => {
    await stubDialogs({ confirm: false });
    await window.evaluate(() => globalThis.open('https://example.com/phish', '_blank'));
    await window.waitForTimeout(1000);
    expect(await opened()).toEqual([]);
    const [call] = await dialogCalls();
    expect(call.options.message).toContain('example.com');

    await stubDialogs({ confirm: true });
    await window.evaluate(() => globalThis.open('https://example.com/phish', '_blank'));
    await window.waitForTimeout(1000);
    expect(await opened()).toEqual(['https://example.com/phish']);
  });

  test('window.open of a file: URL is refused outright', async () => {
    const count = await windowCount();
    await window.evaluate(() => globalThis.open('file:///etc/hosts', '_blank'));
    await window.waitForTimeout(1000);
    expect(await windowCount()).toBe(count);
    expect(await opened()).toEqual([]);
  });

  test('a blob: window (the PDF preview) opens without the bridge', async () => {
    const childPromise = app.waitForEvent('window');
    await window.evaluate(() => {
      const url = URL.createObjectURL(new Blob(['<p>preview</p>'], { type: 'text/html' }));
      globalThis.open(url);
    });
    const child = await childPromise;
    await child.waitForLoadState('domcontentloaded');
    expect(await child.evaluate(() => typeof (globalThis as any).electronAPI)).toBe('undefined');
    const childPreferences = await app.evaluate(({ BrowserWindow }) => {
      const preview = BrowserWindow.getAllWindows().find((w) => w.webContents.getURL().startsWith('blob:'));
      const prefs = (preview?.webContents as any)?.getLastWebPreferences();
      return { preload: prefs?.preload ?? '', sandbox: prefs?.sandbox };
    });
    expect(childPreferences).toEqual({ preload: '', sandbox: true });
    await child.close();
  });

  test('an injected <webview> creates no guest contents', async () => {
    const before = await app.evaluate(({ webContents }) => webContents.getAllWebContents().length);
    await window.evaluate(() => {
      const view = document.createElement('webview');
      view.setAttribute('src', 'https://example.com/');
      document.body.appendChild(view);
    });
    await window.waitForTimeout(1000);
    expect(await app.evaluate(({ webContents }) => webContents.getAllWebContents().length)).toBe(before);
  });

  test('a permission TMX never uses is denied', async () => {
    const state = await window.evaluate(async () => (await navigator.permissions.query({ name: 'geolocation' })).state);
    expect(state).toBe('denied');
  });
});

test.describe('W4 — Content-Security-Policy', () => {
  test('the app itself booted without a CSP violation', async () => {
    const violations = bootConsole.filter((text) => /Content Security Policy/i.test(text));
    expect(violations).toEqual([]);
  });

  test('the document may connect only to its server, not to an arbitrary host', async () => {
    const violated = await window.evaluate(
      () =>
        new Promise<string>((done) => {
          document.addEventListener('securitypolicyviolation', (e) => done(e.effectiveDirective), { once: true });
          fetch('https://exfil.example.net/x').catch(() => undefined);
          setTimeout(() => done('none'), 3000);
        }),
    );
    expect(violated).toBe('connect-src');
  });

  test('the renderer carries a CSP meta tag', async () => {
    const csp = await window.evaluate(
      () => document.querySelector('meta[http-equiv="Content-Security-Policy"]')?.getAttribute('content') ?? '',
    );
    expect(csp).toContain("script-src 'self'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).not.toContain('unsafe-eval');
  });

  test('an injected inline script does not run', async () => {
    const ran = await window.evaluate(async () => {
      const script = document.createElement('script');
      script.textContent = 'globalThis.__inlineRan = true;';
      document.head.appendChild(script);
      await new Promise((r) => setTimeout(r, 50));
      return Boolean((globalThis as any).__inlineRan);
    });
    expect(ran).toBe(false);
  });

  test('an injected script from a non-self source does not run', async () => {
    // A data: URL rather than a remote host: a remote 404 also fires onerror, so it cannot tell a
    // CSP block from a missing file. This one runs unless CSP stops it.
    const ran = await window.evaluate(
      () =>
        new Promise<boolean>((done) => {
          const script = document.createElement('script');
          script.src = 'data:text/javascript,globalThis.__foreignRan = true;';
          script.onload = () => done(Boolean((globalThis as any).__foreignRan));
          script.onerror = () => done(Boolean((globalThis as any).__foreignRan));
          document.head.appendChild(script);
        }),
    );
    expect(ran).toBe(false);
  });
});

test.describe('W5 — the persisted server URL', () => {
  for (const url of ['javascript:alert(1)', 'file:///etc/passwd', 'http://evil.example', 'not a url']) {
    test(`refuses ${url}`, async () => {
      await stubDialogs({ confirm: true });
      const result = await api(window, `return api.setServerUrl(${JSON.stringify(url)});`);
      expect(result).toEqual({ saved: false });
      expect(await api(window, `return api.getServerUrl();`)).not.toBe(url);
    });
  }

  test('an https URL is saved only after the user confirms it in a native dialog', async () => {
    await stubDialogs({ confirm: false });
    expect(await api(window, `return api.setServerUrl('https://tmx.example.org');`)).toEqual({ saved: false });
    expect(await api(window, `return api.getServerUrl();`)).not.toBe('https://tmx.example.org');

    await stubDialogs({ confirm: true });
    const saved = await untilReloaded(() => api(window, `return api.setServerUrl('https://tmx.example.org/');`));
    expect(saved).toEqual({ saved: true });
    expect(await api(window, `return api.getServerUrl();`)).toBe('https://tmx.example.org');
    const [call] = await dialogCalls();
    expect(call.kind).toBe('message');
    expect(call.options.detail).toContain('https://tmx.example.org');
  });

  test('http is accepted for a local development server', async () => {
    await stubDialogs({ confirm: true });
    const saved = await untilReloaded(() => api(window, `return api.setServerUrl('http://localhost:8383');`));
    expect(saved).toEqual({ saved: true });
    expect(await api(window, `return api.getServerUrl();`)).toBe('http://localhost:8383');
  });
});

// Last on purpose: on code without the guard this navigates the window away, and every later test
// would then run on a page with no bridge and pass for the wrong reason.
test.describe('W3 — navigation (runs last)', () => {
  test.beforeEach(async () => {
    await app.evaluate(({ shell }) => {
      const opened: string[] = [];
      (globalThis as any).__opened = opened;
      (shell as any).openExternal = async (url: string) => {
        opened.push(url);
      };
    });
  });
  const opened = (): Promise<string[]> => app.evaluate(() => (globalThis as any).__opened ?? []);

  test('the main window cannot be navigated to a blob: document the page made', async () => {
    const before = withoutHash(window.url());
    await window.evaluate(() => {
      const html = '<script>globalThis.__blobDoc = true</' + 'script>';
      globalThis.location.href = URL.createObjectURL(new Blob([html], { type: 'text/html' }));
    });
    await window.waitForTimeout(1500);
    // The app's own router may change the hash meanwhile; the document must not change.
    expect(withoutHash(window.url())).toBe(before);
  });

  test('navigating the window to a remote origin is refused and handed to the system browser', async () => {
    await stubDialogs({ confirm: true });
    const before = withoutHash(window.url());
    await window.evaluate(() => {
      globalThis.location.href = 'https://example.com/landing';
    });
    await window.waitForTimeout(1500);
    // The app's own router may change the hash meanwhile; the document must not change.
    expect(withoutHash(window.url())).toBe(before);
    expect(await opened()).toEqual(['https://example.com/landing']);
  });
});
