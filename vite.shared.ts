/**
 * Renderer configuration shared by the web build (`vite.config.ts`) and the
 * Electron build (`electron.vite.config.ts`).
 *
 * WHY THIS FILE EXISTS. The two configs used to be hand-copied. When the web
 * config dropped `vite-tsconfig-paths` in favour of Vite's native
 * `resolve.tsconfigPaths`, the Electron copy kept importing the removed
 * package and `pnpm electron:build` broke. That historical gap is now partly
 * covered: lint/type checks include Electron, and its browser workflow runs at checkpoints. Anything the two
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
import { createRequire } from 'module';
import { type Plugin } from 'vite';
import { readFileSync } from 'fs';
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
 *
 * `QUERY_SERVER` is the read-model service (courthive-query), which is a SEPARATE
 * origin from CFS in development — CFS on :8383, query on :3150. In production both
 * are same-origin behind nginx, which routes `/query/*` to the query service, so the
 * default empty string is correct there and only dev needs to set it.
 *
 * `AUTH_SERVER` is the identity provider (courthive-hiveid) — same shape: :3140 in development,
 * same-origin in production, where nginx routes `/auth/*` and `/account/*` to it.
 */
export const rendererPlugins = (): Plugin[] => [
  EnvironmentPlugin({ SERVER: '', QUERY_SERVER: '', AUTH_SERVER: '', ENVIRONMENT: '', PUBLIC_URL: '' }),
  emitVersionJson(),
  precompiledSchemaValidator(),
];

/**
 * The CODES schema validator, compiled at build time (`virtual:tournament-schema-validator`).
 *
 * ajv compiles a schema into a validator with `new Function`, which the web CSP's `script-src 'self'` forbids
 * (journey 164). Its standalone mode emits that validator as plain source instead, so the browser loads code and
 * evaluates nothing. The source is generated from the INSTALLED factory's `tournament.schema.json` whenever a
 * renderer build, the dev server or vitest loads the module: a factory bump needs no regeneration step and there is
 * no generated file to commit or drift. The options match the factory's own schema tests (allowUnionTypes for the
 * schema's ["string", "object"] date-time fields, allErrors so one bad field does not hide the rest);
 * `inlineRefs: false` keeps each definition one function, about a quarter smaller than inlining every $ref.
 *
 * The standalone source `require`s ajv's runtime helpers and ajv-formats' format table. Those are CommonJS, and the
 * dev server, vitest and the production bundler each hand a CommonJS module to an ESM import differently (`.default`
 * is the function in one and `module.exports` in another), so they are not imported: their source is inlined behind
 * a small static `require` and the module carries no imports at all. Inlining is not evaluation: it is ordinary
 * code in the chunk, which the CSP allows.
 */
const SCHEMA_VALIDATOR_ID = 'virtual:tournament-schema-validator';

// `require("x")` as code, not inside a string: ajv's helpers also carry their own require call as a quoted `code` value
const REQUIRE_CALL = /(?<!['"\w.])require\("([^"]+)"\)/g;

/** Inline the CommonJS modules `code` requires (and theirs), and replace each call with an index into them. */
function inlineCommonJs(code: string, fromFile: string): string {
  const files: string[] = [];
  const sources: string[] = [];
  const indexOf = (specifier: string, importer: string): number => {
    const file = createRequire(importer).resolve(specifier);
    let index = files.indexOf(file);
    if (index >= 0) return index;
    index = files.push(file) - 1;
    sources[index] = rewrite(readFileSync(file, 'utf8'), file);
    return index;
  };
  const rewrite = (source: string, importer: string): string =>
    source.replace(REQUIRE_CALL, (_match, specifier: string) => `__require(${indexOf(specifier, importer)})`);

  const body = rewrite(code, fromFile);
  const modules = sources.map((source) => `function (module, exports) {\n${source}\n}`).join(',\n');
  return [
    `const __modules = [${modules}];`,
    'const __cache = [];',
    'function __require(index) {',
    '  if (!__cache[index]) {',
    '    const module = { exports: {} };',
    '    __cache[index] = module;',
    '    __modules[index](module, module.exports);',
    '  }',
    '  return __cache[index].exports;',
    '}',
    body,
  ].join('\n');
}

export function buildSchemaValidatorSource(): { source: string; schemaPath: string } {
  const packageJson = path.resolve(import.meta.dirname, 'package.json');
  const require = createRequire(packageJson);
  const Ajv = require('ajv').default;
  const addFormats = require('ajv-formats').default;
  const standaloneCode = require('ajv/dist/standalone').default;
  const schemaPath = require.resolve('tods-competition-factory/schema/tournament.schema.json');
  const schema = JSON.parse(readFileSync(schemaPath, 'utf8'));

  const ajv = new Ajv({ allowUnionTypes: true, allErrors: true, inlineRefs: false, code: { source: true, esm: true } });
  addFormats(ajv);
  const code: string = standaloneCode(ajv, ajv.compile(schema));
  return { source: inlineCommonJs(code, packageJson), schemaPath };
}

export const precompiledSchemaValidator = (): Plugin => {
  let built: ReturnType<typeof buildSchemaValidatorSource> | undefined;
  return {
    name: 'tmx-precompiled-schema-validator',
    resolveId: (id) => (id === SCHEMA_VALIDATOR_ID ? `\0${SCHEMA_VALIDATOR_ID}` : undefined),
    load(id) {
      if (id !== `\0${SCHEMA_VALIDATOR_ID}`) return undefined;
      built ??= buildSchemaValidatorSource();
      this.addWatchFile(built.schemaPath);
      return built.source;
    },
  };
};

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
