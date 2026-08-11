/* ==================== SERVICE WORKER ==================== */
const CACHE_NAME = 'artesania-cache-v3';
const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/css/variables.css',
  '/css/base.css',
  '/css/components.css',
  '/css/pages.css',
  '/css/animations.css',
  '/js/config.js',
  '/js/safeImage.js',
  '/js/theme.js',
  '/js/ui.js',
  '/js/cart.js',
  '/js/products.js',
  '/js/checkout.js',
  '/js/connection.js',
  '/js/analytics.js',
  '/assets/placeholder-product.svg'
];

const IMAGE_CACHE = 'artesania-images-v1';
const API_CACHE = 'artesania-api-v1';

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_URLS).catch((err) => {
        console.warn('SW precache fallback:', err);
      });
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => ![CACHE_NAME, IMAGE_CACHE, API_CACHE].includes(key))
          .map((key) => caches.delete(key))
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  if (url.pathname.startsWith('/api/')) {
    event.respondWith(networkFirst(request));
    return;
  }

  if (url.pathname.match(/\.(webp|png|jpg|jpeg|svg|gif|ico)$/)) {
    event.respondWith(cacheFirst(request, IMAGE_CACHE));
    return;
  }

  if (url.pathname.match(/\.(css|js|woff2|woff|ttf)$/)) {
    event.respondWith(staleWhileRevalidate(request, CACHE_NAME));
    return;
  }

  if (url.pathname === '/' || url.pathname.endsWith('.html')) {
    event.respondWith(networkFirst(request));
    return;
  }

  event.respondWith(cacheFirst(request, CACHE_NAME));
});

async function cacheFirst(request, cacheName) {
  const cached = await caches.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response && response instanceof Response && response.status === 200) {
      const cache = await caches.open(cacheName);
      try {
        cache.put(request, response.clone());
      } catch (e) {
        console.warn('SW cache put failed:', e);
      }
    }
    return response;
  } catch {
    return new Response('Offline', { status: 503 });
  }
}

async function networkFirst(request) {
  try {
    const response = await fetch(request);
    if (response && response instanceof Response && response.status === 200) {
      const cache = await caches.open(API_CACHE);
      try {
        cache.put(request, response.clone());
      } catch (e) {
        console.warn('SW API cache put failed:', e);
      }
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    if (cached) return cached;
    return new Response(JSON.stringify({ error: 'Offline' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

async function staleWhileRevalidate(request, cacheName) {
  const cached = await caches.match(request);
  try {
    const response = await fetch(request);
    if (response && response instanceof Response && response.status === 200) {
      const cache = await caches.open(cacheName);
      try {
        cache.put(request, response.clone());
      } catch (e) {
        console.warn('SW stale-while-revalidate cache put failed:', e);
      }
      return response;
    }
    return cached || response || new Response('Offline', { status: 503 });
  } catch {
    return cached || new Response('Offline', { status: 503 });
  }
}
