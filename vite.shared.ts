/**
 * Renderer configuration shared by the web build (`vite.config.ts`) and the
 * Electron build (`electron.vite.config.ts`).
 *
 * WHY THIS FILE EXISTS. The two configs used to be hand-copied. When the web
 * config dropped `vite-tsconfig-paths` in favour of Vite's native
 * `resolve.tsconfigPaths`, the Electron copy kept importing the removed
 * package and `pnpm electron:build` broke — invisibly, because no lint, type
 * check, test, or CI job looks at the Electron target. Anything the two
 * renderers must agree on belongs here, so a change to one is a change to both.
 *
 * Electron-specific concerns (output paths, `base`, the main/preload targets)
 * stay in `electron.vite.config.ts`; web-specific ones (dev server, vitest)
 * stay in `vite.config.ts`.
 */
import { version as factoryVersion } from 'tods-competition-factory';
import EnvironmentPlugin from 'vite-plugin-environment';
// Deliberately WITHOUT an `with { type: 'json' }` attribute. Vite's own config
// loader emits an advisory warning asking for one, but this file is also loaded
// by electron-vite, which pre-bundles configs with esbuild — and esbuild rejects
// a named import from an attributed JSON module ("No matching export in
// package.json for import version"), breaking `pnpm electron:build` outright.
// A cosmetic warning on one loader beats a hard failure on the other.
import { version as pkgVersion } from './package.json';
import { type Plugin } from 'vite';
import path from 'path';

// Emits `dist/version.json` at build time so a long-lived TMX tab can poll for
// newer deployments (`src/services/version/checkTmxVersion.ts`) AND so the
// factory-mismatch check can tell whether a refresh would actually resolve a
// client/server engine mismatch (`src/services/version/checkFactoryVersion.ts`).
// `factoryVersion` is the `tods-competition-factory` build bundles — the same
// version its runtime `version()` returns — so a client can compare "what a
// refresh would load" against the server's running engine.
//
// The desktop build emits it too: a packaged TMX talks to a CFS it does not
// deploy in lockstep with, so the engine-mismatch check matters MORE there,
// not less.
export const emitVersionJson = (): Plugin => ({
  name: 'tmx-emit-version-json',
  apply: 'build',
  generateBundle() {
    this.emitFile({
      type: 'asset',
      fileName: 'version.json',
      source:
        JSON.stringify({ version: pkgVersion, factoryVersion: factoryVersion(), builtAt: new Date().toISOString() }) +
        '\n',
    });
  },
});

/**
 * Compile-time env replacement. Both targets read `process.env.SERVER` at
 * runtime; without this plugin the reference survives into the bundle and
 * throws in the browser (and in the Electron renderer, which has no `process`).
 */
export const rendererPlugins = (): Plugin[] => [
  EnvironmentPlugin({ SERVER: '', ENVIRONMENT: '', PUBLIC_URL: '' }),
  emitVersionJson(),
];

// `@courthive/provider-config` ships CJS only (no `module` field, no
// `"type": "module"`). When resolved via pnpm `link:` it bypasses
// Vite's dep pre-bundling, so the on-the-fly CJS→ESM transform misses
// named exports declared via `Object.defineProperty(exports, ...)` —
// exactly what `tsc`-emitted re-exports look like. Force pre-bundling
// so esbuild's full CJS-named-exports detection runs instead.
export const rendererOptimizeDeps = {
  include: ['@courthive/provider-config'],
};

/**
 * `tsconfigPaths: true` is Vite's native replacement for the
 * `vite-tsconfig-paths` plugin — it reads the `paths` map out of
 * `tsconfig.json`, which is how every absolute import in `src/` resolves.
 * A renderer without it fails to resolve `settings/env`, `i18n`, and ~20 more.
 */
export const rendererResolve = {
  tsconfigPaths: true,
  alias: {
    styles: path.resolve(import.meta.dirname, 'src/styles'),
  },
};

export const rendererOnwarn = (warning: any, defaultHandler: (w: any) => void): void => {
  // Suppress CommonJS-in-ESM warning from hotkeys-js (bug in 4.0.2)
  if (warning.code === 'COMMONJS_VARIABLE_IN_ESM') return;
  // The dynamic imports of `baseModal/baseModal.ts` and
  // `services/authentication/loginState.ts` are intentional —
  // baseModal defers `courthive-components` DOM-at-load-time
  // initialisation for vitest's non-DOM default; loginState
  // breaks the static cycle `loginState → authApi → baseApi`.
  // Both are documented inline at their import sites. Other
  // consumers import them statically so code-splitting won't
  // actually move them to a separate chunk; suppress only
  // these specific known cases so new occurrences still surface.
  if (warning.code === 'INEFFECTIVE_DYNAMIC_IMPORT') {
    const msg = warning.message ?? '';
    if (msg.includes('baseModal/baseModal.ts') || msg.includes('loginState.ts')) return;
  }
  defaultHandler(warning);
};
