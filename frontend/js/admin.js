const API_BASE = CONFIG.API.BASE;
const BACKEND_DIRECT_URL = CONFIG.API.BACKEND_URL || '';
let authToken = (typeof sessionStorage !== 'undefined' && sessionStorage.getItem('adminToken')) || '';
let currentUser = null;
window.__setCurrentUser = function(user) { currentUser = user; };
window.__setAdminToken = function(token) {
  authToken = token || '';
  if (typeof sessionStorage !== 'undefined') {
    if (authToken) sessionStorage.setItem('adminToken', authToken);
    else sessionStorage.removeItem('adminToken');
  }
};
window.__getAdminToken = () => authToken;

function getApiUrl(path) {
  if (BACKEND_DIRECT_URL) return `${BACKEND_DIRECT_URL}${path}`;
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

    const res = await fetch(getApiUrl('/api/v1/health'), {
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
    const res = await fetch(getApiUrl('/api/v1/auth/login'), {
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
    window.__setAdminToken(data.token);
     currentUser = { user: data.user, role: data.role, permissions: data.permissions };
     var userNameEl = document.getElementById('adminUserName');
     if (userNameEl && data.user) userNameEl.textContent = data.user;
     window.location.href = '../pages/dashboard.html';
  } catch (err) {
    let userMessage = 'Error inesperado. Por favor, recargá la página.';
    if (err.name === 'AbortError') userMessage = 'El servidor tardó demasiado en responder. Recargá la página e intentá nuevamente.';
    else if (err.message?.includes('Timeout')) userMessage = 'El servidor está iniciando, esperá unos segundos y volvé a intentar.';
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
    await fetch(getApiUrl('/api/v1/auth/logout'), { method: 'POST', credentials: 'include' });
  } catch (e) {
    console.warn('[doLogout] Error cerrando sesión:', e);
  }
  authToken = '';
  currentUser = null;
  window.location.href = '../index.html';
}

async function adminFetch(url, opts = {}, isRetry = false) {
  const apiBase = BACKEND_DIRECT_URL || CONFIG.API.BASE;
  const isUpload = url === '/api/v1/admin/upload';
  const directUploadOrigin = isUpload ? `${BACKEND_DIRECT_URL}${url}` : null;
  const fullUrl = directUploadOrigin || (url.startsWith('/api/v1/') ? `${apiBase}${url}` : url);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60000);
  try {
    const isFormData = opts.body instanceof FormData;
    let finalHeaders = { ...(opts.headers || {}) };
    if (isFormData) {
      delete finalHeaders['Content-Type'];
    }
    if (authToken && !finalHeaders.Authorization) finalHeaders.Authorization = `Bearer ${authToken}`;
    const fetchOpts = { ...opts, headers: finalHeaders, signal: controller.signal, credentials: 'include' };
    if (isUpload) {
      fetchOpts.credentials = 'include';
    }
    const res = await fetch(fullUrl, fetchOpts);
    clearTimeout(timeout);
    if (res.status === 401 && !isRetry) {
      try {
        const refreshRes = await fetch(getApiUrl('/api/v1/auth/refresh'), {
          method: 'POST',
          credentials: 'include'
        });
        if (refreshRes.ok) {
          const refreshData = await refreshRes.json();
          window.__setAdminToken(refreshData.token);
          return adminFetch(url, opts, true);
        }
      } catch (e) {
        console.warn('[adminFetch] Error refrescando token:', e);
      }
      window.__setAdminToken('');
      currentUser = null;
      document.getElementById('loginOverlay')?.classList.remove('hidden');
      throw new Error('Sesión expirada. Iniciá sesión nuevamente.');
    }
    if (res.status === 401) {
      window.__setAdminToken('');
      currentUser = null;
      document.getElementById('loginOverlay')?.classList.remove('hidden');
      throw new Error('Sesión expirada. Iniciá sesión nuevamente.');
    }
    if (res.status === 403) throw new Error('Acceso denegado. No tenés permisos para esta acción.');
    if (!res.ok) {
      let errorMsg = res.statusText;
      const contentType = res.headers.get('content-type') || '';
      let responseBodyForLog = null;
      if (contentType.includes('application/json')) {
        const data = await res.json().catch(() => null);
        errorMsg = (data && data.error) || data?.message || errorMsg;
        responseBodyForLog = data;
      } else {
        errorMsg = await res.text().catch(() => res.statusText);
        responseBodyForLog = errorMsg;
      }
      console.error('[adminFetch] Error response:', {
        status: res.status,
        statusText: res.statusText,
        url: fullUrl,
        body: responseBodyForLog
      });
      throw new Error(errorMsg || `Error ${res.status}`);
    }
    return res;
  } catch (err) {
    clearTimeout(timeout);
    if (err.name === 'AbortError') throw new Error('El servidor no respondió en el tiempo esperado. Verificá tu conexión e intentá nuevamente.');
    if (err.message === 'Failed to fetch' || err.message?.includes('fetch')) throw new Error('No se pudo conectar al servidor. Verificá tu conexión e intentá recargar la página.');
    if (err.message?.includes('NetworkError')) throw new Error('Error de red. Verificá tu conexión a internet e intentá nuevamente.');
    if (err.message?.includes('Timeout')) throw new Error('El servidor está iniciando, esperá unos segundos y volvé a intentar.');
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
window.getCurrentUser = function() {
  if (currentUser) return { username: currentUser.user || currentUser.username || '', role: currentUser.role || '' };
  return {
    username: '',
    role: ''
  };
};
window.getAdminRole = function() { return (currentUser?.role || ''); };
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
  var textSpan = load ? load.previousElementSibling : null;
  if (textSpan && textSpan.id === btnId + 'Text') {
    textSpan.textContent = loading ? (loadingText || 'Procesando...') : (defaultText || 'Guardar');
    textSpan.classList.toggle('hidden', loading);
  }
  if (load) load.classList.toggle('hidden', !loading);
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

function resetConfirmModal() {
  // Deja el modal en estado neutro: sin input destructivo, botón por defecto.
  // Necesario porque el modal se reutiliza (confirms simples, guía de
  // comprobante, confirmación destructiva).
  var msgEl = document.getElementById('confirmModalMessage');
  var actionBtn = document.getElementById('confirmModalAction');
  var wrap = document.getElementById('confirmModalDestructiveWrap');
  if (wrap && wrap.parentNode) wrap.parentNode.removeChild(wrap);
  if (msgEl) msgEl.textContent = '¿Estás seguro?';
  if (actionBtn) {
    actionBtn.textContent = 'Confirmar';
    actionBtn.className = 'btn btn-danger';
    actionBtn.disabled = false;
    actionBtn.onclick = null;
  }
}

function showConfirmModal(title, message, onConfirm) {
  var overlay = document.getElementById('confirmModalOverlay');
  var titleEl = document.getElementById('confirmModalTitle');
  var msgEl = document.getElementById('confirmModalMessage');
  var actionBtn = document.getElementById('confirmModalAction');
  var cancelBtn = document.getElementById('cancelConfirmBtn');
  if (!overlay || !actionBtn) return;
  resetConfirmModal();
  if (titleEl) titleEl.textContent = title || 'Confirmar';
  if (msgEl) msgEl.textContent = message || '¿Estás seguro?';
  actionBtn.textContent = 'Confirmar';
  actionBtn.className = 'btn btn-danger';
  actionBtn.onclick = function () {
    hideConfirmModal();
    if (typeof onConfirm === 'function') onConfirm();
  };
  if (cancelBtn) {
    cancelBtn.onclick = hideConfirmModal;
  }
  overlay.classList.add('active');
  overlay.style.display = '';
}

function hideConfirmModal() {
  resetConfirmModal();
  var overlay = document.getElementById('confirmModalOverlay');
  if (overlay) {
    overlay.classList.remove('active');
    overlay.style.display = 'none';
  }
}

/* Confirmación destructiva en 2 pasos: además del modal hay que escribir
   una palabra (ej: ELIMINAR) para habilitar el botón. Para borrados
   irreversibles como "Eliminar historial". */
function showDestructiveConfirmModal(title, message, requiredText, onConfirm) {
  var overlay = document.getElementById('confirmModalOverlay');
  var titleEl = document.getElementById('confirmModalTitle');
  var msgEl = document.getElementById('confirmModalMessage');
  var actionBtn = document.getElementById('confirmModalAction');
  var cancelBtn = document.getElementById('cancelConfirmBtn');
  if (!overlay || !actionBtn) {
    // Sin modal (tests/entornos sin DOM): pedir confirmación nativa.
    if (typeof window.confirm === 'function' && window.confirm((title || 'Confirmar') + '\n' + (message || ''))) {
      if (typeof onConfirm === 'function') onConfirm();
    }
    return;
  }
  resetConfirmModal();
  var needed = String(requiredText || 'ELIMINAR');
  if (titleEl) titleEl.textContent = title || 'Confirmar eliminación';
  if (msgEl) msgEl.textContent = message || 'Esta acción no se puede deshacer.';

  var wrap = document.createElement('div');
  wrap.id = 'confirmModalDestructiveWrap';
  wrap.className = 'form-group';
  wrap.style.marginTop = '12px';
  var label = document.createElement('label');
  label.textContent = 'Escribí ' + needed + ' para habilitar el botón:';
  label.setAttribute('for', 'confirmModalDestructiveInput');
  var input = document.createElement('input');
  input.type = 'text';
  input.id = 'confirmModalDestructiveInput';
  input.placeholder = needed;
  input.autocomplete = 'off';
  wrap.appendChild(label);
  wrap.appendChild(input);
  if (msgEl && msgEl.parentNode) msgEl.parentNode.appendChild(wrap);

  actionBtn.textContent = 'Eliminar definitivamente';
  actionBtn.className = 'btn btn-danger';
  actionBtn.disabled = true;
  input.addEventListener('input', function () {
    actionBtn.disabled = input.value.trim() !== needed;
  });
  actionBtn.onclick = function () {
    if (input.value.trim() !== needed) return;
    hideConfirmModal();
    if (typeof onConfirm === 'function') onConfirm();
  };
  if (cancelBtn) {
    cancelBtn.onclick = hideConfirmModal;
  }
  overlay.classList.add('active');
  overlay.style.display = '';
  setTimeout(function () { try { input.focus(); } catch (e) { /* noop */ } }, 50);
}

window.showSaveStatus = showSaveStatus;
window.setButtonState = setButtonState;
window.saveToCloud = saveToCloud;
window.showConfirmModal = showConfirmModal;
window.hideConfirmModal = hideConfirmModal;
window.resetConfirmModal = resetConfirmModal;
window.showDestructiveConfirmModal = showDestructiveConfirmModal;

document.addEventListener('DOMContentLoaded', () => {
  const existingToken = typeof sessionStorage !== 'undefined' && sessionStorage.getItem('adminToken');
  const dashboardOverlay = document.getElementById('loginOverlay');
  if (existingToken && dashboardOverlay && document.querySelector('.admin-panel')) {
    dashboardOverlay.classList.add('hidden');
  }

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

  // La ✕ del modal de confirmación no estaba cableada: ahora cierra y resetea.
  const closeConfirmBtn = document.getElementById('closeConfirmModal');
  if (closeConfirmBtn) {
    closeConfirmBtn.onclick = hideConfirmModal;
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

