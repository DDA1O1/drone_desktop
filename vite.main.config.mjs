// vite.main.config.mjs
import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    outDir: 'dist',
    rollupOptions: {
      external: [
        'electron',
        'ws',
        'electron-squirrel-startup',
        'update-electron-app',
        'dgram',
        'child_process'
      ]
    }
  }
});