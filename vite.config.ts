import EnvironmentPlugin from 'vite-plugin-environment';
import { defineConfig, loadEnv } from 'vite';

const viteconfigFactory = ({ mode }: { mode: string }) => {
  // Load app-level env vars to node-level env vars.
  process.env = { ...process.env, ...loadEnv(mode, process.cwd(), '') };

  const BASE_URL = (process.env.BASE_URL && `/${process.env.BASE_URL}/`) || '';

  return defineConfig({
    plugins: [EnvironmentPlugin({ SERVER: '', ENVIRONMENT: '', PUBLIC_URL: '' })],
    resolve: { tsconfigPaths: true },
    build: { sourcemap: true },
    base: BASE_URL,
  });
};

export default viteconfigFactory;
