import { rendererOptimizeDeps, rendererPlugins, rendererResolve, rendererOnwarn } from './vite.shared.ts';
import { defineConfig, loadEnv } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

// Workbox drops any file larger than this from the precache — silently, which
// would leave an "offline-capable" app whose main chunk is not actually cached.
// TMX's largest chunk is well past workbox's 2 MiB default, so the ceiling is
// stated explicitly and generously; the build logs the precache total, so a
// number that stops being enough is visible rather than inferred.
const MAX_PRECACHE_BYTES = 12 * 1024 * 1024;

const viteconfigFactory = ({ mode }: { mode: string }) => {
  // Load app-level env vars to node-level env vars.
  process.env = { ...process.env, ...loadEnv(mode, process.cwd(), '') };

  const BASE_URL = (process.env.BASE_URL && `/${process.env.BASE_URL}/`) || '';

  return defineConfig({
    plugins: [
      ...rendererPlugins(),
      // WEB ONLY — deliberately not in `rendererPlugins()`, which the Electron
      // renderer shares. A packaged desktop app has no origin to scope a service
      // worker to and no network to be offline from.
      //
      // Emitting the worker is NOT the same as using it: `injectRegister: false`
      // means nothing registers it unless `src/serviceWorker.ts` decides to, and
      // that is gated on `SERVICE_WORKER` being explicitly set. A build with the
      // flag unset ships `sw.js` as a dead asset.
      VitePWA({
        // The user accepts an update; it never takes effect under them. Pairs
        // with the `onUpdate` → `updateReady()` notification TMX already has:
        // `skipWaiting`/`clientsClaim` stay off, so a new build waits in the
        // wings rather than swapping the engine out mid-tournament.
        registerType: 'prompt',
        injectRegister: false,
        // TMX already ships `src/assets/manifest.json`, linked from index.html.
        // Generating a second one would leave two manifests disagreeing.
        manifest: false,
        workbox: {
          globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
          // NO `navigateFallback`, and that is a decision rather than an
          // omission: TMX is a HASH router, so every route lives at the same
          // path and the precached `index.html` already answers it. Setting a
          // fallback would put the worker in front of sibling apps served from
          // neighbouring paths by the same nginx (`/pub`, the API) and hand them
          // TMX's shell.
          maximumFileSizeToCacheInBytes: MAX_PRECACHE_BYTES,
        },
      }),
    ],
    server: {
      port: 5173,
      strictPort: true,
    },
    optimizeDeps: rendererOptimizeDeps,
    resolve: rendererResolve,
    build: {
      sourcemap: true,
      rolldownOptions: {
        onwarn: rendererOnwarn,
      },
    },
    base: BASE_URL,
    test: {
      // '.claude/**' keeps a git worktree checked out under .claude/worktrees/ from being
      // discovered as a second copy of the entire suite — Vitest's default `include` globs
      // from the project root, and its default `exclude` does not cover .claude.
      exclude: ['e2e/**', 'node_modules/**', '**/.claude/**'],
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
