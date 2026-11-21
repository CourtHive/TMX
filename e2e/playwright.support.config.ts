import { defineConfig, devices } from '@playwright/test';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  testDir: './journeys',
  testMatch: '223-support-reports.spec.ts',
  workers: 1,
  retries: 0,
  timeout: 45_000,
  outputDir: '/private/tmp/tmx-support-browser-results',
  reporter: 'list',
  use: { baseURL: 'http://127.0.0.1:5187', trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    cwd: fileURLToPath(new URL('..', import.meta.url)),
    command: 'node_modules/.bin/vite --host 127.0.0.1 --port 5187 --strictPort',
    env: {
      SERVER: 'http://127.0.0.1:5187',
      AUTH_SERVER: 'http://127.0.0.1:5187',
      QUERY_SERVER: 'http://127.0.0.1:5187',
      SCORE_RELAY_URL: 'disabled',
      VITE_SCORE_RELAY_URL: 'disabled',
      VITE_AMS_URL: 'http://127.0.0.1:5187',
    },
    url: 'http://127.0.0.1:5187',
    reuseExistingServer: false,
    timeout: 60_000,
  },
});
