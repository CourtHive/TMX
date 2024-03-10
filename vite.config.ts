import EnvironmentPlugin from 'vite-plugin-environment';
import tsconfigPaths from 'vite-tsconfig-paths';
import { defineConfig, loadEnv } from 'vite';

export default ({ mode }) => {
  // Load app-level env vars to node-level env vars.
  process.env = { ...process.env, ...loadEnv(mode, process.cwd(), '') };

  return defineConfig({
    build: { sourcemap: true },
    plugins: [tsconfigPaths(), EnvironmentPlugin(['SERVER', 'ENVIRONMENT'])],
    base: process.env.BASE_URL,
  });
};
