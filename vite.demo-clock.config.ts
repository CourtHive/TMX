import { defineConfig, mergeConfig } from 'vite';
import baseConfig from './vite.config.ts';
import { realpathSync } from 'node:fs';
import { resolve } from 'node:path';

// The demo-clock journeys' own dev server (e2e/playwright.demo-clock.config.ts): its own port and Vite cache, so it
// never attaches to, or shares optimized deps with, another checkout's server. `link:` dependencies resolve into the
// sibling repos, so the server may read from the folder that holds them: the parent of the checkout whose
// node_modules this one really is (a worktree links node_modules to the main checkout's).
const nodeModules = realpathSync(resolve(import.meta.dirname, 'node_modules'));

export default defineConfig(({ mode }) =>
  mergeConfig(baseConfig({ mode }), {
    cacheDir: resolve(import.meta.dirname, 'node_modules/.vite-demo-clock'),
    server: { fs: { allow: [resolve(nodeModules, '../..')] } },
  }),
);
