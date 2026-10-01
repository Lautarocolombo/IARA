(function () {
  'use strict';

  var TOKEN_KEY = 'adminToken';
  var READY = false;

  function getConfig() {
    if (typeof window !== 'undefined' && window.CONFIG) return window.CONFIG;
    if (typeof CONFIG !== 'undefined') return CONFIG;
    return { API: { BASE: '', BACKEND_URL: '' } };
  }

  function getApiUrl(path) {
    var cfg = getConfig();
    var direct = cfg && cfg.API && cfg.API.BACKEND_URL;
    if (direct) return direct + path;
    return (cfg && cfg.API && cfg.API.BASE ? cfg.API.BASE : '') + path;
  }

  function getToken() {
    try { return sessionStorage.getItem(TOKEN_KEY) || ''; } catch (e) { return ''; }
  }

  function setToken(token) {
    try {
      if (token) sessionStorage.setItem(TOKEN_KEY, token);
      else sessionStorage.removeItem(TOKEN_KEY);
    } catch (e) { /* noop */ }
  }

  function parseResponse(res) {
    var type = res.headers && res.headers.get ? res.headers.get('content-type') || '' : '';
    if (type.includes('application/json')) return res.json().catch(function () { return {}; });
    return res.text().then(function (text) { return text ? { message: text } : {}; });
  }

  function adminFetch(path, options) {
    options = options || {};
    var headers = Object.assign({}, options.headers || {});
    if (getToken() && !headers.Authorization) headers.Authorization = 'Bearer ' + getToken();
    if (!(options.body instanceof FormData) && !headers['Content-Type'] && options.body) headers['Content-Type'] = 'application/json';
    var timeout = window.setTimeout(function () {}, 0);
    var controller = new AbortController();
    var request = Object.assign({}, options, { headers: headers, signal: controller.signal, credentials: 'include' });
    window.clearTimeout(timeout);
    timeout = window.setTimeout(function () { controller.abort(); }, 60000);
    return fetch(getApiUrl(path), request).then(function (res) {
      if (res.status === 401 && !options._retry) {
        return fetch(getApiUrl('/api/auth/refresh'), { method: 'POST', credentials: 'include' }).then(function (refreshRes) {
          if (!refreshRes.ok) throw new Error('Sesión expirada');
          return refreshRes.json();
        }).then(function (data) {
          setToken(data.token);
          return adminFetch(path, Object.assign({}, options, { _retry: true }));
        });
      }
      return parseResponse(res).then(function (data) {
        if (!res.ok) {
          var message = data.error || data.message || ('Error ' + res.status);
          if (res.status === 401) {
            setToken('');
            window.location.href = 'admin.html';
          }
          throw new Error(message);
        }
        return data;
      });
    }).catch(function (err) {
      if (err && err.name === 'AbortError') throw new Error('El servidor no respondió en el tiempo esperado.');
      throw err;
    }).finally(function () { window.clearTimeout(timeout); });
  }

  function hideLogin(login) {
    if (login) {
      login.hidden = true;
      document.body.classList.remove('admin-page-locked');
    }
  }

  function showLogin(login) {
    if (login) {
      login.hidden = false;
      document.body.classList.add('admin-page-locked');
    }
  }

  function initAdminPage(options) {
    options = options || {};
    var login = document.getElementById('adminPageLogin');
    var form = document.getElementById('adminPageLoginForm');
    var username = document.getElementById('adminPageUsername');
    var password = document.getElementById('adminPagePassword');
    var message = document.getElementById('adminPageLoginMessage');
    var submit = document.getElementById('adminPageLoginSubmit');
    var logout = document.getElementById('adminPageLogout');
    var ready = function () {
      READY = true;
      hideLogin(login);
      if (typeof options.onReady === 'function') options.onReady();
    };
    if (logout) {
      logout.addEventListener('click', function () {
        adminFetch('/api/auth/logout', { method: 'POST' }).catch(function () { /* noop */ }).finally(function () {
          setToken('');
          window.location.href = 'admin.html';
        });
      });
    }
    if (form) {
      form.addEventListener('submit', function (event) {
        event.preventDefault();
        var user = username ? username.value.trim() : '';
        var pass = password ? password.value : '';
        if (!user || !pass) {
          if (message) message.textContent = 'Ingresá usuario y contraseña';
          return;
        }
        if (submit) {
          submit.disabled = true;
          submit.textContent = 'Ingresando...';
        }
        if (message) message.textContent = '';
        fetch(getApiUrl('/api/auth/login'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ username: user, password: pass })
        }).then(parseResponse).then(function (data) {
          if (!user || !pass) throw new Error('Credenciales incompletas');
          setToken(data.token);
          ready();
        }).catch(function (err) {
          if (message) message.textContent = err.message || 'No se pudo iniciar sesión';
        }).finally(function () {
          if (submit) {
            submit.disabled = false;
            submit.textContent = 'Ingresar';
          }
        });
      });
    }
    if (getToken()) ready();
    else showLogin(login);
    if (options.onInit) options.onInit({ fetch: adminFetch, getToken: getToken, setToken: setToken });
    return { fetch: adminFetch, getToken: getToken, setToken: setToken, ready: ready };
  }

  window.adminPageFetch = adminFetch;
  window.adminPageInit = initAdminPage;
  window.adminPageReady = function () { return READY; };
}());
