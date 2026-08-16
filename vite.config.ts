import { rendererOptimizeDeps, rendererPlugins, rendererResolve, rendererOnwarn } from './vite.shared.ts';
import { defineConfig, loadEnv } from 'vite';

const viteconfigFactory = ({ mode }: { mode: string }) => {
  // Load app-level env vars to node-level env vars.
  process.env = { ...process.env, ...loadEnv(mode, process.cwd(), '') };

  const BASE_URL = (process.env.BASE_URL && `/${process.env.BASE_URL}/`) || '';

  return defineConfig({
    plugins: rendererPlugins(),
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
