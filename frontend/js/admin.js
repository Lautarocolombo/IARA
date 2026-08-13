const API_BASE = CONFIG.API.BASE;
const BACKEND_DIRECT_URL = CONFIG.API.BACKEND_URL || '';
let authToken = localStorage.getItem('ag_admin_token') || '';
window.__getAdminToken = () => authToken;

function getApiUrl(path) {
  if (!API_BASE) return path;
  return `${API_BASE}${path}`;
}

async function checkServerHealth() {
  const hint = document.getElementById('loginHint');
  const retryBtn = document.getElementById('retryHealthBtn');
  const indicator = document.getElementById('connectionIndicator');
  const timeoutMs = 30000;

  let timeoutId;
  try {
    const controller = new AbortController();
    timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    const res = await fetch(getApiUrl('/api/health'), {
      method: 'GET',
      signal: controller.signal,
      headers: { 'Accept': 'application/json' }
    });
    clearTimeout(timeoutId);

    const data = await res.json().catch(() => ({}));

    if (data.status === 'ok' || data.status === 'degraded' || data.status === 'sqlite-fallback') {
      if (hint) {
        hint.textContent = data.status === 'ok'
          ? '✅ Servidor conectado'
          : '✅ Conectado (funciona con base local)';
        hint.style.color = '#10b981';
      }
      if (indicator) indicator.classList.add('connected');
      if (retryBtn) retryBtn.style.display = 'none';
      return;
    }

    throw new Error(`Servidor respondió con estado ${res.status}`);
  } catch (err) {
    clearTimeout(timeoutId);
    let message = '⚠️ El servidor no responde. Podés intentar iniciar sesión.';
    if (err.name === 'AbortError') {
      message = '⚠️ La verificación tardó demasiado. Podés iniciar sesión.';
    }
    if (hint) {
      hint.textContent = message;
      hint.style.color = '#f59e0b';
    }
    if (indicator) indicator.classList.remove('connected');
    if (retryBtn) {
      retryBtn.style.display = 'inline-block';
      retryBtn.addEventListener('click', () => { checkServerHealth(); });
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

let showPassword = false;

function togglePasswordVisibility() {
  showPassword = !showPassword;
  const passwordInput = document.getElementById('loginPass');
  const toggleBtn = document.getElementById('passwordToggle');
  if (passwordInput) {
    passwordInput.type = showPassword ? 'text' : 'password';
  }
  if (toggleBtn) {
    toggleBtn.classList.toggle('showing', showPassword);
    toggleBtn.setAttribute('aria-label', showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña');
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
  const isUpload = url === '/api/admin/upload';
  const directUploadOrigin = isUpload ? `${BACKEND_DIRECT_URL}${url}` : null;
  const fullUrl = directUploadOrigin || (url.startsWith('/api/') ? `${CONFIG.API.BASE}${url}` : url);
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
    const fetchOpts = { ...opts, headers: finalHeaders, signal: controller.signal };
    if (isUpload) {
      fetchOpts.credentials = 'include';
    }
    const res = await fetch(fullUrl, fetchOpts);
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
window.togglePasswordVisibility = togglePasswordVisibility;
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

if (window.SENTRY_DSN) {
  (function() {
    var script = document.createElement('script');
    script.src = 'https://browser.sentry-cdn.com/8.x.x/bundle.min.js';
    script.crossOrigin = 'anonymous';
    script.onload = function() {
      Sentry.init({
        dsn: window.SENTRY_DSN,
        environment: 'production',
        tracesSampleRate: 0.1,
      });
    };
    document.head.appendChild(script);
  })();
}

function showSaveStatus(statusId, type, message) {
  var el = document.getElementById(statusId);
  if (!el) return;
  el.className = 'save-status visible ' + type;
  el.textContent = message;
  setTimeout(function () {
    if (el) { el.className = 'save-status'; el.textContent = ''; }
  }, 4000);
}

function setButtonState(btnId, loadingId, loading, defaultText, loadingText) {
  var btn = document.getElementById(btnId);
  var load = document.getElementById(loadingId);
  if (btn) {
    btn.disabled = loading;
    btn.classList.toggle('is-saving', loading);
  }
  if (load) load.classList.toggle('hidden', !loading);
  var textSpan = load ? load.previousElementSibling : null;
  if (textSpan && textSpan.id === btnId + 'Text') {
    textSpan.textContent = loading ? (loadingText || 'Procesando...') : (defaultText || 'Guardar');
  }
}

async function saveToCloud(section, options) {
  var btnId = options.btnId;
  var loadingId = options.loadingId;
  var defaultText = options.defaultText || 'Guardar en Nube';
  var loadingText = options.loadingText || 'Guardando...';
  var successMessage = options.successMessage || 'Cambios guardados ✅';
  var statusId = options.statusId;
  var action = options.action;

  setButtonState(btnId, loadingId, true, defaultText, loadingText);
  if (statusId) showSaveStatus(statusId, 'saving', 'Guardando cambios...');

  try {
    await action();
    if (statusId) showSaveStatus(statusId, 'success', successMessage);
    window.showToast('✅', successMessage, 'success');
    return true;
  } catch (err) {
    console.error('[saveToCloud] Error guardando ' + section + ':', err);
    var errMsg = err.message || 'Error al guardar, intentá de nuevo';
    if (statusId) showSaveStatus(statusId, 'error', errMsg);
    window.showToast('❌', errMsg, 'error');
    return false;
  } finally {
    setButtonState(btnId, loadingId, false, defaultText, loadingText);
  }
}

window.showSaveStatus = showSaveStatus;
window.setButtonState = setButtonState;
window.saveToCloud = saveToCloud;

document.addEventListener('DOMContentLoaded', () => {
  const passwordToggle = document.getElementById('passwordToggle');
  if (passwordToggle) {
    passwordToggle.addEventListener('click', togglePasswordVisibility);
  }

  const loginForm = document.getElementById('loginForm');
  const loginBtn = document.getElementById('loginBtn');
  if (loginForm) {
    loginForm.addEventListener('submit', function(e) {
      e.preventDefault();
      doLogin();
    });
  } else if (loginBtn) {
    loginBtn.addEventListener('click', doLogin);
  }

  if (window.location.protocol === 'file:') {
    const fields = ['loginUser', 'loginPass', 'passwordToggle', 'loginBtn'];
    fields.forEach(id => {
      const el = document.getElementById(id);
      if (el) el.disabled = true;
    });
    const hint = document.getElementById('loginHint');
    if (hint) {
      hint.textContent = '⚠️ Abrí este panel desde el servidor.';
      hint.style.color = '#ef4444';
    }
  } else if (document.getElementById('loginHint')) {
    checkServerHealth();
  }
});
