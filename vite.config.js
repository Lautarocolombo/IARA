import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  root: resolve(__dirname, 'frontend'),
  publicDir: resolve(__dirname, 'frontend', 'assets'),
  build: {
    outDir: resolve(__dirname, 'dist'),
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'frontend', 'index.html'),
        ...Object.fromEntries(
          ['cart', 'checkout', 'orders', 'wishlist', 'product', 'admin', 'admin-products', 'admin-orders', 'admin-payments', 'admin-users', 'admin-categories', 'admin-coupons', 'admin-testimonials', 'admin-content', 'admin-hero', 'admin-reports', 'admin-sales', 'admin-shipping', 'admin-media']
            .filter(name => {
              const path = resolve(__dirname, 'frontend', 'pages', `${name}.html`);
              return require('fs').existsSync(path);
            })
            .map(name => [name, resolve(__dirname, 'frontend', 'pages', `${name}.html`)])
        )
      },
      output: {
        manualChunks: {
          vendor: ['qrcode']
        }
      }
    },
    minify: 'terser',
    cssCodeSplit: true,
    sourcemap: true
  },
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true
      }
    }
  }
});
