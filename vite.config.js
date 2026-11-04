import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath } from 'url';
import { defineConfig, loadEnv } from 'vite';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, __dirname, '');
  const raw_port = Number(
    process.env.LUMEN_PORT ||
      process.env.SERVER_PORT ||
      process.env.PORT ||
      env.LUMEN_PORT ||
      env.SERVER_PORT ||
      env.PORT
  );
  const custom_port =
    Number.isFinite(raw_port) && raw_port > 0 && raw_port <= 65535
      ? Math.floor(raw_port)
      : 3000;

  return {
    plugins: [react()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      host: '0.0.0.0',
      port: custom_port,
      allowedHosts: true,
      // HMR is disabled in AI Studio runtime environment.
      hmr: false,
      watch: null,
    },
  };
});
