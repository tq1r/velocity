import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 1420,
    strictPort: true,
  },
  clearScreen: false,
  envPrefix: ['VITE_', 'TAURI_ENV_*'],
  build: {
    target: ['es2020', 'chrome105', 'safari13'],
    sourcemap: true,
  },
});
