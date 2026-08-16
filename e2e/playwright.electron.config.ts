import { defineConfig } from '@playwright/test';

/**
 * Playwright configuration for the TMX **desktop** target.
 *
 * Separate from `playwright.config.ts` because the two share almost nothing:
 * the web journeys drive a Vite dev server over http with a `chromium` project,
 * while these specs launch the *packaged build output* through Electron's own
 * runtime over `file://`. There is no `webServer`, no `baseURL`, and no browser
 * project — `_electron.launch()` supplies the whole environment.
 *
 * These are deliberately SMOKE tests, not journeys. They answer one question the
 * web suite structurally cannot: **does the thing we ship to a tournament
 * director's laptop actually start?** Every defect found on 2026-08-15 (a config
 * importing a removed package, an absolute `base` that breaks `file://`, and a
 * preload emitted under a name `main.ts` does not load) was invisible to lint,
 * tsc, vitest, and the web e2e suite alike.
 *
 * Run: `pnpm test:electron` (builds first via `pnpm electron:build`).
 */
export default defineConfig({
  testDir: './electron',
  outputDir: './test-results-electron',

  // Each spec launches its own Electron process; serialise so window focus and
  // the shared `userData` directory cannot interfere.
  fullyParallel: false,
  workers: 1,

  // No retries. A flaky desktop launch is a real defect in the packaged app, and
  // retrying would hide exactly the intermittent-startup class this suite exists
  // to catch.
  retries: 0,
  timeout: 60_000,

  reporter: process.env.CI ? [['html', { open: 'never' }]] : [['list']],

  use: {
    trace: 'retain-on-failure',
  },
});
