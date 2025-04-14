// vite.main.config.mjs
import { defineConfig } from 'vite';

export default defineConfig({
  // ... other config
  build: {
    rollupOptions: {
      external: [
        'electron', // Already likely there
        'ws', // Add ws here
        // Add any other *pure* Node.js modules you might use directly in main
      ]
    }
  },
  resolve: {
    // Ensure Node.js built-ins can be resolved if needed, though often handled automatically
    alias: {
       path: 'path',
       fs: 'fs',
       dgram: 'dgram',
       child_process: 'child_process',
       // Add other built-ins if you import them explicitly
    },
  },
});