/**
 * Electron-specific Vite configuration (electron-vite v5).
 *
 * Uses electron-vite to build main process, preload, and renderer separately.
 * The renderer config reuses the same plugins as the web vite.config.ts.
 */
import { defineConfig } from 'electron-vite';
import EnvironmentPlugin from 'vite-plugin-environment';
import tsconfigPaths from 'vite-tsconfig-paths';
import { resolve } from 'path';

// Only externalize the 'electron' package, not our electron/ directory
const isElectronPackage = (id: string) => id === 'electron' || id.startsWith('electron/dist');

export default defineConfig({
  main: {
    build: {
      externalizeDeps: false,
      outDir: 'dist-electron/main',
      rollupOptions: {
        input: resolve(__dirname, 'electron/main.ts'),
        external: isElectronPackage,
      },
    },
  },
  preload: {
    build: {
      externalizeDeps: false,
      outDir: 'dist-electron/preload',
      rollupOptions: {
        input: resolve(__dirname, 'electron/preload.ts'),
        external: isElectronPackage,
      },
    },
  },
  renderer: {
    root: '.',
    plugins: [tsconfigPaths(), EnvironmentPlugin({ SERVER: '', ENVIRONMENT: '', PUBLIC_URL: '' })],
    build: {
      outDir: 'dist',
      sourcemap: true,
      rollupOptions: {
        input: resolve(__dirname, 'index.html'),
      },
    },
  },
});
