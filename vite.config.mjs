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

export default defineConfig(({ mode }) => ({
  customLogger: viteLogger,
  root: resolve(__dirname, 'frontend'),
  publicDir: false,
  build: {
    outDir: resolve(__dirname, 'dist'),
    emptyOutDir: true,
    target: 'es2020',
    chunkSizeWarningLimit: 600,
    assetsInlineLimit: 4096,
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
        manualChunks(id) {
          if (id.includes('node_modules')) return 'vendor';
          return undefined;
        },
      }
    },
    minify: 'esbuild',
    cssCodeSplit: true,
    cssMinify: true,
    sourcemap: mode !== 'production'
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
      name: 'copy-static-assets',
      closeBundle() {
        const pairs = [
          ['imagenes', 'imagenes'],
          ['assets', 'assets'],
          ['js', 'js'],
        ];
        for (const [srcName, destName] of pairs) {
          const srcDir = resolve(__dirname, 'frontend', srcName);
          const destDir = resolve(__dirname, 'dist', destName);
          if (existsSync(srcDir)) {
            copyRecursive(srcDir, destDir);
            console.log(`[vite] ${srcName}/ copiado a dist/${destName}/`);
          }
        }
        const rootFiles = ['sw-v4.js', 'robots.txt', 'sitemap.xml'];
        try {
          for (const f of readdirSync(resolve(__dirname, 'frontend'))) {
            if (f.startsWith('google') && f.endsWith('.html')) rootFiles.push(f);
          }
        } catch (e) { /* noop */ }
        for (const file of rootFiles) {
          const src = resolve(__dirname, 'frontend', file);
          if (existsSync(src)) {
            copyFileSync(src, resolve(__dirname, 'dist', file));
            console.log(`[vite] ${file} copiado a dist/`);
          }
        }
      }
    }
  ]
}));