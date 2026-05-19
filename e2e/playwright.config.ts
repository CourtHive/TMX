import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright E2E configuration for TMX.
 *
 * See Mentat/planning/PLAYWRIGHT_E2E_TESTING.md for the full testing strategy.
 *
 * Three-layer assertion architecture:
 *   Layer 1 — Mutation log (client-side, via dev.context + page.on('console'))
 *   Layer 2 — Server audit trail (future — gated on SERVER_AUDIT_TRAIL Phase A)
 *   Layer 3 — DOM assertions (tmxConstants IDs + ARIA roles)
 */
export default defineConfig({
  testDir: './journeys',
  outputDir: './test-results',

  // Journeys are stateful — run sequentially to avoid interference
  fullyParallel: false,
  workers: 1,

  // Match CI behaviour locally — the full-suite run takes ~5 min and the
  // Vite dev server intermittently misbehaves under that load. Failing
  // tests retry up to twice; the third attempt determines the result.
  retries: 2,
  timeout: 60_000,

  // Reporter: default for local, HTML for CI
  reporter: process.env.CI ? [['html', { open: 'never' }]] : [['list']],

  use: {
    baseURL: process.env.TEST_PROD ? 'http://localhost:4173' : 'http://localhost:5173',

    // Trace + screenshot on failure for debugging
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'on-first-retry',

    // Reasonable viewport for tournament management UI
    viewport: { width: 1440, height: 900 },
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    // Uncomment for cross-browser parity testing (Phase 4+)
    // { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    // { name: 'webkit', use: { ...devices['Desktop Safari'] } },
  ],

  webServer: {
    // Bump Node heap for the Vite dev server — the default ~1.7GB caps out
    // on long e2e runs (Vite's module graph + HMR state grow over hundreds
    // of page navigations). Without this, mid-suite specs near the tail
    // intermittently hit ERR_CONNECTION_REFUSED or slow renders.
    command: process.env.TEST_PROD
      ? 'pnpm build && pnpm preview'
      : 'NODE_OPTIONS=--max-old-space-size=4096 pnpm start',
    url: process.env.TEST_PROD ? 'http://localhost:4173' : 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
});
