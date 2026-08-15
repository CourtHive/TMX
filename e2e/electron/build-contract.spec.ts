import { expect, test } from '@playwright/test';
import { readFileSync, readdirSync } from 'fs';
import { resolve } from 'path';

/**
 * Static assertions on the Electron build OUTPUT.
 *
 * These never launch Electron, so they run in milliseconds and give a precise
 * diagnosis when the app fails to boot — a launch failure tells you "blank
 * window", these tell you *which* contract broke.
 *
 * What they cover:
 *
 *   1. `package.json#main` drifting from the emitted main entry
 *   2. `electron/main.ts` referencing a preload filename the build does not emit
 *      — a REAL defect found 2026-08-15 (electron-vite v5 changed
 *      `entryFileNames` from `.mjs` to `.js`)
 *   3. an absolute asset base, which would resolve to `file:///assets/*` under
 *      `loadFile()` and render a blank window. This one is PRE-EMPTIVE, not
 *      corrective: electron-vite currently forces a relative base for the
 *      renderer and ignores any `base` set in config (verified by building with
 *      `base` unset, `'./'` and `'/'` — the emitted HTML is identical). The
 *      assertion exists because that is an upstream default we do not control,
 *      and it was falsified against hand-edited HTML rather than against config.
 *
 * Nothing in the source tree changes when these break — only the build output —
 * which is precisely why source-level gates (lint, tsc, vitest) cannot see them.
 */

// `import.meta.dirname` rather than `__dirname`: package.json declares
// `"type": "module"`, so these specs are loaded as ESM.
const repoRoot = resolve(import.meta.dirname, '../..');
const read = (relativePath: string) => readFileSync(resolve(repoRoot, relativePath), 'utf-8');

test.describe('electron build contract', () => {
  test('package.json main points at the emitted main entry', () => {
    const pkg = JSON.parse(read('package.json'));
    expect(pkg.main, 'package.json#main must be set for electron-builder to find the entry').toBeTruthy();

    // Must exist on disk — readFileSync throws with the offending path if not.
    const mainSource = read(pkg.main);
    expect(mainSource.length).toBeGreaterThan(0);
  });

  test('main entry loads a preload file that the build actually emits', () => {
    const pkg = JSON.parse(read('package.json'));
    const mainSource = read(pkg.main);

    // `electron/main.ts` composes the path as path.join(__dirname, '<relative>').
    const preloadReference = /preload:\s*path\.join\(__dirname,\s*["']([^"']+)["']\)/.exec(mainSource);
    expect(preloadReference, 'could not locate the preload path expression in the built main entry').not.toBeNull();

    const referencedPath = preloadReference![1];
    const resolvedPreload = resolve(repoRoot, pkg.main, '..', referencedPath);

    // The failure this catches is silent at runtime: Electron logs nothing, the
    // window opens, and `window.electronAPI` is simply never injected.
    expect(
      () => readFileSync(resolvedPreload, 'utf-8'),
      `main references ${referencedPath}, which was not emitted`,
    ).not.toThrow();
  });

  test('the EMITTED preload file is named .mjs so Electron loads it as ESM', () => {
    const pkg = JSON.parse(read('package.json'));

    // Electron accepts an ESM preload ONLY when the file is named `.mjs`. This
    // assertion is meaningless unless the package is ESM, so tie the two
    // together rather than hard-coding the expectation.
    test.skip(pkg.type !== 'module', 'package is CommonJS — preload extension is unconstrained');

    // Assert on the BUILD OUTPUT directory, not on what main.ts references —
    // an earlier version of this test checked the reference and passed happily
    // while the build was emitting `preload.js`, which is the very defect it was
    // written to catch.
    const emitted = readdirSync(resolve(repoRoot, 'dist-electron/preload'));
    expect(emitted, `preload output directory contains: ${emitted.join(', ')}`).toContain('preload.mjs');
  });

  test('renderer index.html uses relative asset paths', () => {
    const html = read('dist/index.html');
    const references = [...html.matchAll(/(?:src|href)="([^"]+)"/g)].map((m) => m[1]);

    const localReferences = references.filter((ref) => !/^(?:https?:|data:|mailto:|#)/.test(ref));
    expect(localReferences.length, 'no local asset references found — did the renderer build run?').toBeGreaterThan(0);

    // An absolute `/assets/...` under the file:// protocol resolves off the
    // FILESYSTEM ROOT, not the app bundle. The window renders blank and the
    // main process reports nothing.
    const absolute = localReferences.filter((ref) => ref.startsWith('/'));
    expect(absolute, `absolute asset paths break file:// loading: ${absolute.join(', ')}`).toEqual([]);
  });

  test('renderer emits version.json for the engine-mismatch check', () => {
    const version = JSON.parse(read('dist/version.json'));

    // A packaged desktop client talks to a CFS it is not deployed in lockstep
    // with, so `checkFactoryVersion` matters more here than on the web.
    expect(version.version, 'missing app version').toBeTruthy();
    expect(version.factoryVersion, 'missing tods-competition-factory version').toBeTruthy();
  });
});
