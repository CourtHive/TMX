import EnvironmentPlugin from 'vite-plugin-environment';
import { defineConfig, loadEnv, type Plugin } from 'vite';
import { version as pkgVersion } from './package.json';
import path from 'path';

// Emits `dist/version.json` at build time so a long-lived TMX tab can poll
// for newer deployments. See `src/services/version/checkTmxVersion.ts`.
const emitVersionJson = (): Plugin => ({
  name: 'tmx-emit-version-json',
  apply: 'build',
  generateBundle() {
    this.emitFile({
      type: 'asset',
      fileName: 'version.json',
      source: JSON.stringify({ version: pkgVersion, builtAt: new Date().toISOString() }) + '\n',
    });
  },
});

const viteconfigFactory = ({ mode }: { mode: string }) => {
  // Load app-level env vars to node-level env vars.
  process.env = { ...process.env, ...loadEnv(mode, process.cwd(), '') };

  const BASE_URL = (process.env.BASE_URL && `/${process.env.BASE_URL}/`) || '';

  return defineConfig({
    plugins: [EnvironmentPlugin({ SERVER: '', ENVIRONMENT: '', PUBLIC_URL: '' }), emitVersionJson()],
    resolve: {
      tsconfigPaths: true,
      alias: {
        styles: path.resolve(__dirname, 'src/styles'),
      },
    },
    build: {
      sourcemap: true,
      rolldownOptions: {
        onwarn(warning, defaultHandler) {
          // Suppress CommonJS-in-ESM warning from hotkeys-js (bug in 4.0.2)
          if (warning.code === 'COMMONJS_VARIABLE_IN_ESM') return;
          defaultHandler(warning);
        },
      },
    },
    base: BASE_URL,
    test: {
      exclude: ['e2e/**', 'node_modules/**'],
    },
  });
};

export default viteconfigFactory;
