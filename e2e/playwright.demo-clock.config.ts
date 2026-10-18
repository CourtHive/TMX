import { defineConfig, devices } from '@playwright/test';

/** Isolated port and Vite cache: never attach this journey to another session's checkout. */
export default defineConfig({
  testDir: './journeys',
  testMatch: '*demo-clock.spec.ts',
  outputDir: './test-results/demo-clock',
  workers: 1,
  retries: 0,
  timeout: 60_000,
  use: {
    baseURL: 'http://127.0.0.1:5187',
    viewport: { width: 1440, height: 1000 },
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'pnpm exec vite --config vite.demo-clock.config.ts --port 5187 --host 127.0.0.1',
    cwd: '..',
    url: 'http://127.0.0.1:5187',
    reuseExistingServer: false,
    timeout: 30_000,
  },
});
