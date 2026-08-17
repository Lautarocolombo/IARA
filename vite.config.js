import { defineConfig } from 'vite';
import { resolve } from 'path';
import { readdirSync } from 'fs';
import { copyFileSync, mkdirSync, existsSync, readdirSync as fsReaddirSync } from 'fs';

function copyRecursive(src, dest) {
  if (!existsSync(dest)) mkdirSync(dest, { recursive: true });
  const entries = fsReaddirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = resolve(src, entry.name);
    const destPath = resolve(dest, entry.name);
    if (entry.isDirectory()) {
      copyRecursive(srcPath, destPath);
    } else {
      copyFileSync(srcPath, destPath);
    }
  }
}

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
  plugins: [
    {
      name: 'copy-images',
      closeBundle() {
        const srcDir = resolve(__dirname, 'frontend', 'imagenes');
        const destDir = resolve(__dirname, 'dist', 'imagenes');
        if (existsSync(srcDir)) {
          copyRecursive(srcDir, destDir);
          console.log('[vite] Imágenes copiadas a dist/imagenes/');
        }
      }
    }
  ]
});
