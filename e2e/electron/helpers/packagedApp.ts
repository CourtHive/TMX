import { chromium, type Browser, type Page } from '@playwright/test';
import { spawn, type ChildProcess } from 'child_process';
import { dirname, resolve } from 'path';
import { readFileSync } from 'fs';

/**
 * Drives the PACKAGED app over the Chrome DevTools Protocol.
 *
 * Playwright's `_electron.launch` attaches through the Node inspector (`--inspect`), which the
 * shipped app disables with the `EnableNodeCliInspectArguments` fuse — so the real artifact can no
 * longer be launched that way. `--remote-debugging-port` is a Chromium switch the fuses leave alone,
 * so the renderer is still reachable. There is no main-process access (`app.evaluate`) here; specs
 * that stub dialogs in main run against the unpackaged build, or against a package built with
 * `-c.electronFuses.enableNodeCliInspectArguments=true` (see security.spec.ts).
 */
export interface PackagedApp {
  page: Page;
  close: () => Promise<void>;
}

export async function launchPackagedOverCdp(
  executablePath: string,
  userDataDir: string,
  env: NodeJS.ProcessEnv = process.env,
): Promise<PackagedApp> {
  const child: ChildProcess = spawn(executablePath, ['--remote-debugging-port=0', `--user-data-dir=${userDataDir}`], {
    env,
    stdio: ['ignore', 'ignore', 'pipe'],
  });
  const endpoint = await new Promise<string>((done, fail) => {
    const timer = setTimeout(() => fail(new Error('packaged app printed no DevTools endpoint')), 30_000);
    child.stderr?.on('data', (chunk) => {
      const match = /DevTools listening on (ws:\S+)/.exec(String(chunk));
      if (match) {
        clearTimeout(timer);
        done(match[1]);
      }
    });
    child.on('exit', (code) => fail(new Error(`packaged app exited early (${code})`)));
  });
  const browser: Browser = await chromium.connectOverCDP(endpoint);
  const context = browser.contexts()[0];
  const page = context.pages()[0] ?? (await context.waitForEvent('page'));
  return {
    page,
    close: async () => {
      await browser.close().catch(() => undefined);
      child.kill();
    },
  };
}

/** Electron's fuse sentinel; the fuse wire (version, length, one byte per fuse) follows it. */
const FUSE_SENTINEL = 'dL7pKGdnNz796PbbjQWNKmHXBZaB9tsX';

/** Fuse states read from the packaged binary, keyed by `FuseV1Options` order: '0' off, '1' on. */
export function readFuseWire(executablePath: string): string {
  const binary =
    process.platform === 'darwin'
      ? resolve(dirname(executablePath), '../Frameworks/Electron Framework.framework/Electron Framework')
      : executablePath;
  const bytes = readFileSync(binary);
  const at = bytes.indexOf(FUSE_SENTINEL);
  if (at < 0) throw new Error(`no fuse sentinel in ${binary}`);
  const length = bytes[at + FUSE_SENTINEL.length + 1];
  const start = at + FUSE_SENTINEL.length + 2;
  return bytes.subarray(start, start + length).toString('latin1');
}
