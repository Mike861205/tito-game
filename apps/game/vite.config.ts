import { defineConfig, loadEnv } from 'vite';
import { resolve } from 'node:path';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, resolve(process.cwd(), '../..'), 'VITE_');
  return {
    envDir: resolve(process.cwd(), '../..'),
    server: {
      port: 5173,
      strictPort: true,
      proxy: {
        '/api': {
          target: env.VITE_API_URL ?? 'http://localhost:3001',
          changeOrigin: true,
        },
      },
    },
    build: {
      target: 'es2022',
      sourcemap: mode !== 'production',
      chunkSizeWarningLimit: 1600,
      rollupOptions: {
        output: {
          manualChunks: { phaser: ['phaser'] },
        },
      },
    },
  };
});
