const API_BASE = CONFIG.API.BASE;
let authToken = localStorage.getItem('ag_admin_token') || '';
window.__getAdminToken = () => authToken;

function getApiUrl(path) {
  if (!API_BASE) return path;
  return `${API_BASE}${path}`;
}

async function checkServerHealth() {
  const btn = document.getElementById('loginBtn');
  const hint = document.getElementById('loginHint');
  const retryBtn = document.getElementById('retryHealthBtn');
  const indicator = document.getElementById('connectionIndicator');
  const timeoutMs = 30000;
  const maxAttempts = 2;
  let attempt = 0;

  while (attempt < maxAttempts) {
    attempt++;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    try {
      if (btn) btn.textContent = attempt > 1 ? 'Verificando...' : 'Verificando...';
      if (btn) btn.disabled = true;
      const res = await fetch(getApiUrl('/api/health'), {
        method: 'GET',
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      if (!res.ok) throw new Error(`Servidor respondió con estado ${res.status}`);
      if (hint) {
        hint.textContent = '✅ Servidor conectado';
        hint.style.color = '#10b981';
      }
      if (indicator) indicator.classList.add('connected');
      if (retryBtn) retryBtn.style.display = 'none';
      return;
    } catch (err) {
      clearTimeout(timeoutId);
      if (attempt < maxAttempts) {
        await new Promise(r => setTimeout(r, 3000));
        continue;
      }
      let message = '⚠️ El servidor no responde. Podés intentar igualmente iniciar sesión.';
      if (err.name === 'AbortError') {
        message = '⚠️ La verificación tardó demasiado. Revisá tu conexión o probá de nuevo.';
      }
      if (hint) {
        hint.textContent = message;
        hint.style.color = '#f59e0b';
      }
      if (indicator) indicator.classList.remove('connected');
      if (retryBtn) {
        retryBtn.style.display = 'inline-block';
        retryBtn.onclick = () => { checkServerHealth(); };
      }
    } finally {
      if (btn) { btn.textContent = 'Ingresar'; btn.disabled = false; }
    }
  }
}

function showLoginError(errorEl, message) {
  if (errorEl) {
    errorEl.textContent = message;
    errorEl.style.display = 'block';
  }
}

function clearLoginError(errorEl) {
  if (errorEl) {
    errorEl.style.display = 'none';
    errorEl.textContent = '';
  }
}

async function doLogin() {
  const username = document.getElementById('loginUser').value.trim();
  const password = document.getElementById('loginPass').value;
  const errorEl = document.getElementById('loginError');
  clearLoginError(errorEl);
  if (!username || !password) {
    showLoginError(errorEl, 'Ingresá usuario y contraseña');
    return;
  }
  const btn = document.getElementById('loginBtn');
  try {
    btn.textContent = 'Ingresando...';
    btn.disabled = true;
    const controller = new AbortController();
    const timeoutMs = 15000;
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    const res = await fetch(getApiUrl('/api/auth/login'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ username, password }),
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      let errorMsg = data.error || `Error ${res.status}`;
      if (res.status === 401) errorMsg = 'Usuario o contraseña incorrectos';
      else if (res.status === 400) errorMsg = data.error || 'Datos inválidos';
      else if (res.status === 500) errorMsg = 'Error en el servidor. Recargá la página e intentá nuevamente.';
      throw new Error(errorMsg);
    }
     authToken = data.token;
    localStorage.setItem('ag_admin_token', authToken);
    const userNameEl = document.getElementById('adminUserName');
    if (userNameEl && data.user) userNameEl.textContent = data.user;
    window.location.href = '../pages/dashboard.html';
  } catch (err) {
    let userMessage = 'Error inesperado. Por favor, recargá la página.';
    if (err.name === 'AbortError') userMessage = 'El servidor tardó demasiado en responder. Recargá la página e intentá nuevamente.';
    else if (err.name === 'TypeError' && err.message.includes('fetch')) userMessage = 'No se pudo conectar al servidor. Verificá tu conexión o recargá la página.';
    else userMessage = err.message || userMessage;
    showLoginError(errorEl, userMessage);
  } finally {
    btn.textContent = 'Ingresar';
    btn.disabled = false;
  }
}

async function doLogout() {
  try {
    await fetch(getApiUrl('/api/auth/logout'), { method: 'POST', credentials: 'include' });
  } catch (e) {
    console.warn('[doLogout] Error cerrando sesión:', e);
  }
  authToken = '';
  localStorage.removeItem('ag_admin_token');
  window.location.href = '../index.html';
}

async function adminFetch(url, opts = {}, isRetry = false) {
  if (!authToken) throw new Error('No autorizado');
  const headers = { Authorization: `Bearer ${authToken}`, ...(opts.headers || {}) };
  const fullUrl = url.startsWith('/api/') ? `${CONFIG.API.BASE}${url}` : url;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);
  try {
    const isFormData = opts.body instanceof FormData;
    let finalHeaders = headers;
    if (isFormData) {
      /* eslint-disable-next-line no-unused-vars */
      const { 'Content-Type': _ct, ...rest } = headers;
      finalHeaders = rest;
    }
    const res = await fetch(fullUrl, { ...opts, headers: finalHeaders, signal: controller.signal, credentials: 'include' });
    clearTimeout(timeout);
    if (res.status === 401 && !isRetry) {
      try {
        const refreshRes = await fetch(getApiUrl('/api/auth/refresh'), {
          method: 'POST',
          credentials: 'include'
        });
        if (refreshRes.ok) {
          const refreshData = await refreshRes.json();
          authToken = refreshData.token;
          return adminFetch(url, opts, true);
        }
      } catch (e) {
        console.warn('[adminFetch] Error refrescando token:', e);
      }
      authToken = '';
      document.getElementById('loginOverlay')?.classList.remove('hidden');
      throw new Error('Sesión expirada. Iniciá sesión nuevamente.');
    }
    if (res.status === 401) {
      authToken = '';
      document.getElementById('loginOverlay')?.classList.remove('hidden');
      throw new Error('Sesión expirada. Iniciá sesión nuevamente.');
    }
    if (res.status === 403) throw new Error('Acceso denegado. No tenés permisos para esta acción.');
    if (!res.ok) {
      let errorMsg = res.statusText;
      const contentType = res.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        const data = await res.json().catch(() => null);
        errorMsg = (data && data.error) || data?.message || errorMsg;
      } else {
        errorMsg = await res.text().catch(() => res.statusText);
      }
      throw new Error(errorMsg || `Error ${res.status}`);
    }
    return res;
  } catch (err) {
    clearTimeout(timeout);
    if (err.name === 'AbortError') throw new Error('El servidor no respondió en el tiempo esperado. Verificá tu conexión e intentá nuevamente.');
    if (err.message === 'Failed to fetch' || err.message?.includes('fetch')) throw new Error('No se pudo conectar al servidor. Verificá tu conexión e intentá recargar la página.');
    throw err;
  }
}

window.doLogin = doLogin;
window.doLogout = doLogout;
window.checkServerHealth = checkServerHealth;
window.showLoginError = showLoginError;
window.clearLoginError = clearLoginError;
window.getAuthToken = function() { return authToken; };
window.adminFetch = adminFetch;

window.addEventListener('error', function(event) {
  console.error('[GlobalError]', event.message, 'at', event.filename + ':' + event.lineno + ':' + event.colno, event.error);
});

window.addEventListener('unhandledrejection', function(event) {
  console.error('[UnhandledRejection]', event.reason);
});
