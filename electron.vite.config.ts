/**
 * Electron-specific Vite configuration (electron-vite v5).
 *
 * Builds main process, preload, and renderer separately. The renderer shares
 * its plugin/resolve/warning surface with the web build via `vite.shared.ts` —
 * see the note there for why that file exists rather than a second hand-copy.
 */
import { rendererOptimizeDeps, rendererPlugins, rendererResolve, rendererOnwarn } from './vite.shared.ts';
import { defineConfig } from 'electron-vite';
import { resolve } from 'path';

// Only externalize the 'electron' package, not our electron/ directory
const isElectronPackage = (id: string) => id === 'electron' || id.startsWith('electron/dist');

export default defineConfig({
  main: {
    build: {
      externalizeDeps: false,
      outDir: 'dist-electron/main',
      rollupOptions: {
        input: resolve(import.meta.dirname, 'electron/main.ts'),
        external: isElectronPackage,
      },
    },
  },
  preload: {
    build: {
      externalizeDeps: false,
      outDir: 'dist-electron/preload',
      rollupOptions: {
        input: resolve(import.meta.dirname, 'electron/preload.ts'),
        external: isElectronPackage,
        // PIN the extension. `package.json` declares `"type": "module"`, so the
        // emitted preload is ESM — and Electron only accepts an ESM preload when
        // the file is named `.mjs`. electron-vite v5 defaults `entryFileNames` to
        // `[name].js`, which silently produced `preload.js` while `electron/main.ts`
        // (and the docs) referenced `preload.mjs`. The failure mode is quiet:
        // Electron logs nothing, `window.electronAPI` is simply never injected, and
        // every native capability degrades to its web fallback — native file
        // dialogs become browser downloads, the server-URL setting stops
        // persisting, and menu actions no-op. `preloadBridge.spec.ts` asserts the
        // bridge is actually present so this cannot regress silently again.
        // `format` must be restated: electron-vite validates the preload output
        // format explicitly, and supplying an `output` object drops the default
        // it would otherwise have inferred from `"type": "module"`.
        output: { format: 'es', entryFileNames: 'preload.mjs' },
      },
    },
  },
  renderer: {
    root: '.',
    plugins: rendererPlugins(),
    optimizeDeps: rendererOptimizeDeps,
    resolve: rendererResolve,
    // NO `base` here on purpose. The packaged app is served through
    // `loadFile(...)` over `file://`, where an absolute base would resolve assets
    // off the FILESYSTEM ROOT and render a blank window — but electron-vite
    // already forces a relative base for the renderer and IGNORES any value set
    // here (verified empirically: emitted `index.html` is byte-identical with
    // `base` unset, `'./'`, and `'/'`). Setting it would be inert config that
    // looks load-bearing. `build-contract.spec.ts` asserts the emitted HTML stays
    // relative, so a change in that upstream default is caught by a test rather
    // than by a config line that cannot enforce it.
    build: {
      outDir: 'dist',
      sourcemap: true,
      rollupOptions: {
        input: resolve(import.meta.dirname, 'index.html'),
        onwarn: rendererOnwarn,
      },
    },
  },
});
