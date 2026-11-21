import { defineConfig } from '@playwright/test';
import base from './playwright.config';

export default defineConfig(base, {
  use: { baseURL: 'http://localhost:5181' },
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI
    ? [
        ['list'],
        ['html', { outputFolder: 'warp-report', open: 'never' }],
        ['json', { outputFile: 'warp-results.json' }],
      ]
    : base.reporter,
  webServer: {
    command: 'node_modules/.bin/vite --port 5181 --strictPort',
    cwd: '..',
    env: {
      SERVER: 'http://localhost:5181',
      AUTH_SERVER: 'http://localhost:5181',
      QUERY_SERVER: 'http://localhost:5181',
      SCORE_RELAY_URL: 'disabled',
      VITE_SCORE_RELAY_URL: 'disabled',
      VITE_AMS_URL: 'http://localhost:5181',
    },
    url: 'http://localhost:5181',
    reuseExistingServer: false,
    timeout: 30_000,
  },
});
