const CACHE_NAME = 'iara-pwa-v1';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/pages/product.html',
  '/pages/admin.html',
  '/css/variables.css',
  '/css/base.css',
  '/css/components.css',
  '/css/animations.css',
  '/js/config.js',
  '/js/csrf.js',
  '/js/cart.js',
  '/js/wishlist.js',
  '/js/ui.js',
  '/js/products.js',
  '/js/product.js',
  '/js/payment.js',
  '/js/admin-panel.js',
  '/js/theme.js',
  '/manifest.json',
  '/favicon.svg'
];

const IMAGE_CACHE = 'iara-images-v1';
const API_CACHE = 'iara-api-v1';
const API_TTL_MS = 5 * 60 * 1000;

const PRECACHE_URLS = new Set(STATIC_ASSETS);

async function precache() {
  const cache = await caches.open(CACHE_NAME);
  await cache.addAll([...PRECACHE_URLS]);
}

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response && response.status === 200) {
    const cache = await caches.open(CACHE_NAME);
    cache.put(request, response.clone());
  }
  return response;
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(API_CACHE);
  const cached = await cache.match(request);
  const fetchPromise = fetch(request).then((response) => {
    if (response && response.status === 200) {
      cache.put(request, response.clone());
    }
    return response;
  }).catch(() => cached);

  return cached || fetchPromise;
}

function isApiRequest(request) {
  return request.url.includes('/api/');
}

function isImageRequest(request) {
  return request.url.match(/\.(png|jpg|jpeg|svg|gif|webp|ico)$/);
}

self.addEventListener('install', (event) => {
  event.waitUntil(precache());
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  if (isImageRequest(request)) {
    event.respondWith(cacheFirst(request));
    return;
  }

  if (isApiRequest(request)) {
    event.respondWith(staleWhileRevalidate(request));
    return;
  }

  event.respondWith(cacheFirst(request));
});

self.addEventListener('push', (event) => {
  if (!event.data) return;
  try {
    const data = event.data.json();
    const title = data.title || 'IARA';
    const options = {
      body: data.body || '',
      icon: '/assets/icons/icon-192x192.png',
      badge: '/assets/icons/icon-192x192.png',
      data: data.url || '/',
      actions: data.actions || []
    };
    event.waitUntil(self.registration.showNotification(title, options));
  } catch {
    const title = 'IARA';
    event.waitUntil(self.registration.showNotification(title, { body: event.data.text() || '' }));
  }
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data || '/';
  event.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
    for (const client of clientList) {
      if (client.url === new URL(url).href && 'focus' in client) {
        return client.focus();
      }
    }
    if (self.clients.openWindow) {
      return self.clients.openWindow(url);
    }
  }));
});

self.addEventListener('message', (event) => {
  if (!event.data || event.data.type !== 'CACHE_URLS') return;
  const urls = Array.isArray(event.data.urls) ? event.data.urls : [];
  caches.open(CACHE_NAME).then((cache) => cache.addAll(urls));
});

module.exports = {};
