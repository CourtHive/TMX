import { defineConfig, mergeConfig } from 'vite';
import baseConfig from './vite.config.ts';
import { resolve } from 'node:path';

export default defineConfig(({ mode }) =>
  mergeConfig(baseConfig({ mode }), {
    cacheDir: '/tmp/tmx-scheduling-demo-clock-vite',
    server: { fs: { allow: [resolve(import.meta.dirname, '../../..')] } },
  }),
);
