/**
 * Electron-specific Vite configuration (electron-vite v6).
 *
 * Builds main process, preload, and renderer separately. The renderer shares
 * its plugin/resolve/warning surface with the web build via `vite.shared.ts` —
 * see the note there for why that file exists rather than a second hand-copy.
 */
import { rendererOptimizeDeps, rendererPlugins, rendererResolve, rendererOnwarn } from './vite.shared.ts';
import { defineConfig } from 'electron-vite';
import { createHash } from 'crypto';
import type { Plugin } from 'vite';
import { resolve } from 'path';

// Only externalize the 'electron' package, not our electron/ directory. An array, not a predicate:
// electron-vite 6 appends its own externals to this option, and rolldown refuses a function inside the array.
const isElectronPackage = ['electron', /^electron\/dist/];

/**
 * Content-Security-Policy for the packaged renderer, injected as a `<meta>` at build time. The renderer
 * was loaded over `file://`, which carries no response headers, when this was written; it is now served
 * from `app://tmx` (`electron/main.ts` `serveRenderer`), which also sends a per-load header CSP naming the
 * configured server (`electron/policy.ts` `connectSources`). Both apply, so a connection must pass both.
 * Web builds are unaffected; a CSP for the web PWA is a separate decision.
 *
 * Each allowance, with its reason:
 * - script-src: own bundle, plus a sha256 hash per inline `<script>` in index.html (the theme
 *   bootstrap). No 'unsafe-inline', no 'unsafe-eval'.
 * - style-src 'unsafe-inline': TMX writes `style="…"` attributes through innerHTML at many sites;
 *   CSP gates those attributes. Styles cannot run script.
 * - img-src https: data: blob: — provider logos and map tiles come from configured hosts; charts
 *   and previews use data:/blob: URLs.
 * - connect-src https: wss: and local http/ws — the server URL is chosen by the user at runtime,
 *   so a static policy cannot name it; local hosts serve development.
 * - worker-src / frame-src blob: — PDF generation and the blob: PDF preview.
 * - object-src 'none', base-uri 'none', form-action 'none': nothing in TMX uses them.
 * frame-ancestors is not settable from a <meta> and is moot for a top-level desktop window.
 */
function electronContentSecurityPolicy(): Plugin {
  return {
    name: 'tmx-electron-csp',
    apply: 'build',
    transformIndexHtml: {
      order: 'post',
      handler(html) {
        const inlineScripts = [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)];
        const hashes = inlineScripts.map(
          ([, body]) => `'sha256-${createHash('sha256').update(body).digest('base64')}'`,
        );
        const local = 'http://localhost:* ws://localhost:* http://127.0.0.1:* ws://127.0.0.1:*';
        const policy = [
          "default-src 'self'",
          ["script-src 'self'", ...hashes].join(' '),
          "style-src 'self' 'unsafe-inline'",
          "img-src 'self' data: blob: https:",
          "font-src 'self' data:",
          `connect-src 'self' https: wss: ${local}`,
          "media-src 'self' data: blob:",
          "worker-src 'self' blob:",
          "frame-src 'self' blob:",
          "object-src 'none'",
          "base-uri 'none'",
          "form-action 'none'",
        ].join('; ');
        return html.replace('<head>', `<head>\n    <meta http-equiv="Content-Security-Policy" content="${policy}" />`);
      },
    },
  };
}

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
        // CommonJS, named `.cjs`. The window runs with `sandbox: true`, and a sandboxed preload cannot
        // be an ES module: Electron evaluates it as a classic script with a restricted `require`
        // (`electron` only, here). An ESM preload under the sandbox fails quietly — nothing is
        // logged, `window.electronAPI` is never injected, and every native capability degrades to
        // its web fallback. The `.cjs` extension keeps Node's `"type": "module"` from claiming the
        // file. `build-contract.spec.ts` and `preload-bridge.spec.ts` assert the emitted name and
        // that the bridge is present. `format` must be stated: electron-vite validates the preload
        // output format, and supplying an `output` object drops the default it would infer.
        output: { format: 'cjs', entryFileNames: 'preload.cjs' },
      },
    },
  },
  renderer: {
    root: '.',
    plugins: [...rendererPlugins(), electronContentSecurityPolicy()],
    optimizeDeps: rendererOptimizeDeps,
    resolve: rendererResolve,
    // NO `base` here on purpose. The packaged app was served through `loadFile(...)`
    // over `file://`, where an absolute base would resolve assets off the FILESYSTEM
    // ROOT and render a blank window; it is now served from `app://tmx`, where the
    // relative base is still the right one — and in any case electron-vite
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
