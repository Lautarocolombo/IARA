import { defineConfig } from 'vite';
import { resolve } from 'path';
import { readdirSync } from 'fs';

export default defineConfig({
  root: resolve(__dirname, 'frontend'),
  publicDir: resolve(__dirname, 'frontend'),
  build: {
    outDir: resolve(__dirname, 'dist'),
    emptyOutDir: true,
    rollupOptions: {
      input: (() => {
        const pagesDir = resolve(__dirname, 'frontend', 'pages');
        const entries = { main: resolve(__dirname, 'frontend', 'index.html') };
        try {
          const files = readdirSync(pagesDir);
          for (const file of files) {
            if (file.endsWith('.html')) {
              const name = file.replace(/\.html$/, '');
              entries[name] = resolve(pagesDir, file);
            }
          }
        } catch (e) {
          // pages dir not found
        }
        return entries;
      })(),
      output: {
        manualChunks: undefined,
      }
    },
    minify: 'esbuild',
    cssCodeSplit: true,
    sourcemap: true
  },
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true
      },
      '/uploads': {
        target: 'http://localhost:3001',
        changeOrigin: true
      }
    }
  }
});
