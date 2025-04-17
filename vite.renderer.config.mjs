// vite.renderer.config.mjs
import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite'; // <-- Ensure you have this plugin if using Tailwind CSS
import react from '@vitejs/plugin-react'; // <-- Make sure you have this plugin for React
import path from 'node:path'; // <-- Import Node.js path module

// https://vitejs.dev/config
export default defineConfig({
    plugins: [
        react(), // <-- Make sure the React plugin is included
        tailwindcss(), // <-- Ensure you have this plugin if using Tailwind CSS
    ],
    // Add the resolve configuration block
    resolve: {
        alias: {
            // This tells Vite that "@/" should resolve to the "src/renderer" directory
            '@': path.resolve(__dirname, './src/renderer'),
        },
    },
});