import { createLogger, defineConfig } from 'vite';
import { resolve } from 'path';
import { readdirSync, copyFileSync, mkdirSync, existsSync, readdirSync as fsReaddirSync } from 'fs';

const viteLogger = createLogger();
const originalWarn = viteLogger.warn;
viteLogger.warn = (msg, options) => {
  if (msg.includes("can't be bundled without type=\"module\" attribute")) return;
  originalWarn(msg, options);
};

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

const isProduction = process.env.NODE_ENV === 'production';

export default defineConfig({
  customLogger: viteLogger,
  root: resolve(__dirname),
  publicDir: resolve(__dirname, '..', 'public'),
  build: {
    outDir: resolve(__dirname, '..', 'dist'),
    emptyOutDir: true,
    rollupOptions: {
      input: (() => {
        const pagesDir = resolve(__dirname, 'pages');
        const entries = { main: resolve(__dirname, 'index.html') };
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
        manualChunks: (id) => {
          if (id.includes('node_modules')) {
            if (id.includes('chart.js')) return 'chart';
            if (id.includes('quill')) return 'quill';
            if (id.includes('qrcode')) return 'qrcode';
            return 'vendor';
          }
        },
      }
    },
    minify: 'esbuild',
    cssCodeSplit: true,
    sourcemap: !isProduction
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        secure: false
      }
    }
  },
  plugins: [
    {
      name: 'copy-images',
      closeBundle() {
        const srcDir = resolve(__dirname, '..', 'public', 'imagenes');
        const destDir = resolve(__dirname, '..', 'dist', 'imagenes');
        if (existsSync(srcDir)) {
          copyRecursive(srcDir, destDir);
          console.log('[vite] Imágenes copiadas a dist/imagenes/');
        }
      }
    }
  ]
});