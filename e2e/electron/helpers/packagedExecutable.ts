import { existsSync, readdirSync } from 'fs';
import { resolve } from 'path';

const RELEASE_DIR = resolve(import.meta.dirname, '../../../release');

/**
 * Locate the packaged executable for the current platform. Returns undefined
 * when no package has been built, which switches the whole suite to skipped.
 */
export function findPackagedExecutable(): string | undefined {
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
