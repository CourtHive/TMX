import EnvironmentPlugin from 'vite-plugin-environment';
import { defineConfig, loadEnv, type Plugin } from 'vite';
import { version as pkgVersion } from './package.json';
import path from 'path';

// Emits `dist/version.json` at build time so a long-lived TMX tab can poll
// for newer deployments. See `src/services/version/checkTmxVersion.ts`.
const emitVersionJson = (): Plugin => ({
  name: 'tmx-emit-version-json',
  apply: 'build',
  generateBundle() {
    this.emitFile({
      type: 'asset',
      fileName: 'version.json',
      source: JSON.stringify({ version: pkgVersion, builtAt: new Date().toISOString() }) + '\n',
    });
  },
});

const viteconfigFactory = ({ mode }: { mode: string }) => {
  // Load app-level env vars to node-level env vars.
  process.env = { ...process.env, ...loadEnv(mode, process.cwd(), '') };

  const BASE_URL = (process.env.BASE_URL && `/${process.env.BASE_URL}/`) || '';

  return defineConfig({
    plugins: [EnvironmentPlugin({ SERVER: '', ENVIRONMENT: '', PUBLIC_URL: '' }), emitVersionJson()],
    server: {
      port: 5173,
      strictPort: true,
    },
    // `@courthive/provider-config` ships CJS only (no `module` field, no
    // `"type": "module"`). When resolved via pnpm `link:` it bypasses
    // Vite's dep pre-bundling, so the on-the-fly CJS→ESM transform misses
    // named exports declared via `Object.defineProperty(exports, ...)` —
    // exactly what `tsc`-emitted re-exports look like. Force pre-bundling
    // so esbuild's full CJS-named-exports detection runs instead.
    optimizeDeps: {
      include: ['@courthive/provider-config'],
    },
    resolve: {
      tsconfigPaths: true,
      alias: {
        styles: path.resolve(__dirname, 'src/styles'),
      },
    },
    build: {
      sourcemap: true,
      rolldownOptions: {
        onwarn(warning, defaultHandler) {
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
        },
      },
    },
    base: BASE_URL,
    test: {
      exclude: ['e2e/**', 'node_modules/**'],
      // Quiet the suite: many error-path tests deliberately trigger a caught
      // error whose handler logs via console.error/warn (e.g. "[localCalendar]
      // failed to maintain entry"). Those are asserted on behaviorally, so the
      // console output is pure noise in an otherwise-passing run. onConsoleLog
      // only controls whether Vitest ECHOES the log to the terminal — it does
      // not stub console, so tests that vi.spyOn(console, …) still observe their
      // calls. Set VITEST_VERBOSE=1 to see console output while debugging.
      onConsoleLog: () => (process.env.VITEST_VERBOSE ? undefined : false),
    },
  });
};

export default viteconfigFactory;
