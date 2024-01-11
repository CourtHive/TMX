import tsconfigPaths from 'vite-tsconfig-paths';
import { defineConfig, loadEnv } from 'vite';

export default ({ mode }) => {
  // Load app-level env vars to node-level env vars.
  process.env = { ...process.env, ...loadEnv(mode, process.cwd(), '') };

  const BASE_URL = (process.env.BASE_URL && `/${process.env.BASE_URL}/`) || '';

  return defineConfig({
    build: { sourcemap: true },
    plugins: [tsconfigPaths()],
    base: BASE_URL,
  });
};
