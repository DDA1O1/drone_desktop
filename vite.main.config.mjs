// vite.main.config.mjs
import { defineConfig } from 'vite';

export default defineConfig({
  build: { // <-- Add this build section
    rollupOptions: {
      external: [
        'bufferutil', // Tell Vite/Rollup not to bundle this
        'utf-8-validate',
        'ffmpeg-static' // Also exclude this common optional ws dependency
      ]
    }
  }
});