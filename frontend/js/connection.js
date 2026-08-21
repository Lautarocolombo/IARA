'use strict';

const CHECK_INTERVAL = 30000;
const KEEP_ALIVE_INTERVAL = 10 * 60 * 1000;
const MAX_RETRIES = 4;
const BASE_DELAY = 1000;

let status = {
  online: navigator.onLine,
  backend: 'checking',
  lastCheck: null,
  retryCount: 0,
  checking: false
};

const listeners = new Set();

const Connection = {};

Connection.subscribe = function (fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
};

function notify() {
  listeners.forEach(fn => {
    try { fn(status); } catch (e) { console.warn('[Connection] listener error:', e); }
  });
}

Connection.setStatus = function (partial) {
  status = { ...status, ...partial };
  notify();
};

Connection.checkBackend = async function () {
  if (status.checking) return;
  Connection.setStatus({ checking: true, backend: 'checking' });

  const controller = new AbortController();
  const timeoutMs = 60000;
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const fetchPromise = fetch(`${CONFIG.API.BASE}/api/health`, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
      signal: controller.signal
    });
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('timeout')), timeoutMs)
    );
    const res = await Promise.race([fetchPromise, timeoutPromise]);
    clearTimeout(timeoutId);
    const data = await res.json().catch(() => ({}));
    const isOk = res.ok && (data.status === 'ok' || data.status === 'degraded' || data.status === 'sqlite-fallback');

    Connection.setStatus({
      backend: isOk ? 'connected' : 'error',
      lastCheck: Date.now(),
      retryCount: 0,
      checking: false
    });
  } catch (err) {
    clearTimeout(timeoutId);
    console.error('[connection] checkBackend: error', err.name, err.message, err);
    const isOffline = !navigator.onLine || err.name === 'AbortError';
    const nextRetry = Math.min(status.retryCount + 1, MAX_RETRIES);

    Connection.setStatus({
      backend: isOffline ? 'offline' : 'error',
      lastCheck: Date.now(),
      retryCount: nextRetry,
      checking: false
    });

    if (nextRetry < MAX_RETRIES && !isOffline) {
      const delay = BASE_DELAY * Math.pow(2, nextRetry - 1);
      setTimeout(() => Connection.checkBackend(), delay);
    }
  }
};

Connection.startMonitoring = function () {
  window.addEventListener('online', () => {
    Connection.setStatus({ online: true, backend: 'checking' });
    Connection.checkBackend();
    hideOfflineBanner();
  });

  window.addEventListener('offline', () => {
    Connection.setStatus({ online: false, backend: 'offline' });
    showOfflineBanner();
  });

  Connection.setStatus({ online: navigator.onLine, backend: navigator.onLine ? 'checking' : 'offline' });
  if (!navigator.onLine) {
    showOfflineBanner();
  }
  Connection.checkBackend();
  setInterval(() => {
    if (navigator.onLine) {
      Connection.checkBackend();
    }
  }, CHECK_INTERVAL);

  setInterval(() => {
    if (navigator.onLine) {
      Connection.keepAlive();
    }
  }, KEEP_ALIVE_INTERVAL);
};

function showOfflineBanner() {
  let banner = document.getElementById('offlineBanner');
  if (!banner) {
    banner = document.createElement('div');
    banner.id = 'offlineBanner';
    banner.style.cssText = 'position:fixed;bottom:20px;left:50%;transform:translateX(-50%);background:#dc2626;color:white;padding:12px 24px;border-radius:8px;z-index:9999;font-weight:600;box-shadow:0 4px 12px rgba(0,0,0,0.15);';
    banner.textContent = 'Sin conexión - Mostrando contenido guardado';
    document.body.appendChild(banner);
  }
  banner.style.display = 'block';
}

function hideOfflineBanner() {
  const banner = document.getElementById('offlineBanner');
  if (banner) {
    banner.style.display = 'none';
  }
}

Connection.keepAlive = async function () {
  try {
    const controller = new AbortController();
    const timeoutMs = 5000;
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    const fetchPromise = fetch(`${CONFIG.API.BASE}/api/health`, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
      signal: controller.signal
    });
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('timeout')), timeoutMs)
    );
    await Promise.race([fetchPromise, timeoutPromise]);
    clearTimeout(timeoutId);
  } catch (e) {
    console.warn('[connection] keepAlive falló:', e);
  }
};

Connection.getStatus = function () {
  return status;
};

Connection.retryNow = function () {
  Connection.setStatus({ retryCount: 0 });
  Connection.checkBackend();
};

window.Connection = Connection;

if (typeof module !== 'undefined' && module.exports) {
  module.exports = Connection;
}
