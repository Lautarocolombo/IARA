(function () {
  'use strict';

  const CHECK_INTERVAL = 30000;
  const KEEP_ALIVE_INTERVAL = 10 * 60 * 1000;
  const MAX_RETRIES = 4;
  const BASE_DELAY = 1000;
  const TIMEOUT = 10000;

  let status = {
    online: navigator.onLine,
    backend: 'checking',
    lastCheck: null,
    retryCount: 0,
    checking: false
  };

  const listeners = new Set();

  function subscribe(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  }

  function notify() {
    listeners.forEach(fn => {
      try { fn(status); } catch (e) { /* noop */ }
    });
  }

  function setStatus(partial) {
    status = { ...status, ...partial };
    notify();
  }

  async function checkBackend() {
    if (status.checking) return;
    setStatus({ checking: true, backend: 'checking' });

    const controller = new AbortController();
    const timeoutMs = 10000;
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

      setStatus({
        backend: isOk ? 'connected' : 'error',
        lastCheck: Date.now(),
        retryCount: 0,
        checking: false
      });
    } catch (err) {
      clearTimeout(timeoutId);
      const isOffline = !navigator.onLine || err.name === 'AbortError';
      const nextRetry = Math.min(status.retryCount + 1, MAX_RETRIES);

      setStatus({
        backend: isOffline ? 'offline' : 'error',
        lastCheck: Date.now(),
        retryCount: nextRetry,
        checking: false
      });

      if (nextRetry < MAX_RETRIES && !isOffline) {
        const delay = BASE_DELAY * Math.pow(2, nextRetry - 1);
        setTimeout(() => checkBackend(), delay);
      }
    }
  }

  function startMonitoring() {
    window.addEventListener('online', () => {
      setStatus({ online: true, backend: 'checking' });
      checkBackend();
    });

    window.addEventListener('offline', () => {
      setStatus({ online: false, backend: 'offline' });
    });

    setStatus({ online: navigator.onLine, backend: 'checking' });
    checkBackend();
    setInterval(() => {
      if (navigator.onLine) {
        checkBackend();
      }
    }, CHECK_INTERVAL);

    setInterval(() => {
      if (navigator.onLine) {
        keepAlive();
      }
    }, KEEP_ALIVE_INTERVAL);
  }

  async function keepAlive() {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      await fetch(`${CONFIG.API.BASE}/api/health`, {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
        signal: controller.signal
      });
      clearTimeout(timeoutId);
    } catch (e) {
      // silencioso: solo mantenemos el intento
    }
  }

  function getStatus() {
    return status;
  }

  function retryNow() {
    setStatus({ retryCount: 0 });
    checkBackend();
  }

  window.Connection = {
    subscribe,
    getStatus,
    startMonitoring,
    retryNow,
    checkBackend
  };
})();
