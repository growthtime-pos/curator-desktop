import { resolve } from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * Standalone Vite config for serving the renderer in Playwright tests.
 * This bypasses electron-vite so we can test the UI in a regular browser.
 */
export default defineConfig({
  root: resolve(__dirname, 'src/renderer'),
  resolve: {
    alias: {
      '@renderer': resolve(__dirname, 'src/renderer/src'),
    },
    dedupe: ['react', 'react-dom'],
  },
  plugins: [react()],
  server: {
    host: '127.0.0.1',
    port: 4173,
    strictPort: true,
  },
});
