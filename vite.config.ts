import EnvironmentPlugin from 'vite-plugin-environment';
import { defineConfig, loadEnv } from 'vite';
import path from 'path';

const viteconfigFactory = ({ mode }: { mode: string }) => {
  // Load app-level env vars to node-level env vars.
  process.env = { ...process.env, ...loadEnv(mode, process.cwd(), '') };

  const BASE_URL = (process.env.BASE_URL && `/${process.env.BASE_URL}/`) || '';

  return defineConfig({
    plugins: [EnvironmentPlugin({ SERVER: '', ENVIRONMENT: '', PUBLIC_URL: '' })],
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
