/**
 * Every `import.meta.env` read must be one Vite can replace.
 *
 * Vite replaces `import.meta.env.X` statically and provides no `import.meta.env` object at runtime. A read written
 * any other way — `import.meta?.env?.X`, `(import.meta as any)?.env?.X` — is left in the bundle and is always
 * undefined, so the setting it reads is silently ignored. Three were: VITE_SCORE_RELAY_URL, VITE_DECLARATIONS_URL and
 * VITE_AMS_URL, found 2026-10-24 when a Guidon journey gave TMX a relay URL and TMX called localhost:8384 anyway.
 *
 * Vitest itself DOES provide `import.meta.env` as an object, so a unit test of the read can pass while the built app
 * ignores it. This scans the source instead.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import path from 'node:path';

const SRC = path.resolve(__dirname, '..', '..');
const UNREPLACEABLE = /import\.meta\s*\?\.\s*env|\(\s*import\.meta\s+as\s+any\s*\)\s*\??\.\s*env/;

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) return sourceFiles(full);
    return /\.(ts|js|svelte)$/.test(name) && !/\.test\.ts$/.test(name) ? [full] : [];
  });
}

describe('import.meta.env reads', () => {
  it('scans a source tree that exists', () => {
    expect(sourceFiles(SRC).length).toBeGreaterThan(100);
  });

  it('are all written so Vite replaces them', () => {
    const offenders = sourceFiles(SRC).flatMap((file) =>
      readFileSync(file, 'utf8')
        .split('\n')
        .map((line, i) => ({ line, at: `${path.relative(SRC, file)}:${i + 1}` }))
        .filter(({ line }) => UNREPLACEABLE.test(line) && !line.trim().startsWith('*') && !line.trim().startsWith('//'))
        .map(({ at, line }) => `${at}  ${line.trim()}`),
    );
    expect(offenders).toEqual([]);
  });
});
