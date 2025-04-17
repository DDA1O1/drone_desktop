// vite.main.config.mjs
import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    rollupOptions: {
      external: [
        'ws', 
      ]
    }
  }
});