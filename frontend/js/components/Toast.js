(function () {
  'use strict';

  function escapeHtml(value) {
    if (value === null || value === undefined) return '';
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function getContainer() {
    var container = document.getElementById('toastContainer');
    if (!container) {
      container = document.createElement('div');
      container.id = 'toastContainer';
      container.className = 'toast-container';
      container.setAttribute('aria-live', 'polite');
      document.body.appendChild(container);
    }
    return container;
  }

  function showToastMessage(icon, message, type, options) {
    type = type || 'default';
    options = options || {};
    var container = getContainer();
    var toast = document.createElement('div');
    toast.className = 'toast toast--' + type;
    toast.setAttribute('role', options.role || 'status');
    toast.setAttribute('aria-live', 'polite');

    var iconNode = document.createElement('span');
    iconNode.className = 'toast-icon';
    iconNode.setAttribute('aria-hidden', 'true');
    iconNode.textContent = icon || '';
    var body = document.createElement('div');
    body.className = 'toast-body';
    var messageNode = document.createElement('div');
    messageNode.className = 'toast-message';
    messageNode.textContent = message || '';
    body.appendChild(messageNode);
    if (options.onRetry) {
      var retry = document.createElement('button');
      retry.type = 'button';
      retry.className = 'toast-retry';
      retry.textContent = 'Reintentar';
      retry.addEventListener('click', function () {
        close();
        if (typeof options.onRetry === 'function') options.onRetry();
      });
      body.appendChild(retry);
    }
    var close = function () {
      toast.classList.add('toast--closing');
      window.setTimeout(function () { if (toast.parentNode) toast.parentNode.removeChild(toast); }, 250);
    };
    var closeButton = document.createElement('button');
    closeButton.type = 'button';
    closeButton.className = 'toast-close';
    closeButton.setAttribute('aria-label', 'Cerrar notificación');
    closeButton.innerHTML = '<span aria-hidden="true">&times;</span>';
    closeButton.addEventListener('click', close);
    toast.appendChild(iconNode);
    toast.appendChild(body);
    toast.appendChild(closeButton);
    container.appendChild(toast);
    var duration = Number.isFinite(options.duration) ? options.duration : 3200;
    if (duration > 0) window.setTimeout(close, duration);
    return { toast: toast, close: close };
  }

  function Toast(options) {
    this.options = options || {};
  }
  Toast.show = showToastMessage;
  Toast.success = function (message, options) { return showToastMessage('✓', message, 'success', options); };
  Toast.error = function (message, options) { return showToastMessage('!', message, 'error', options); };
  Toast.info = function (message, options) { return showToastMessage('i', message, 'info', options); };
  Toast.prototype.show = function (icon, message, type) {
    return showToastMessage(icon, message, type, this.options);
  };

  window.Toast = Toast;
  window.showToastMessage = showToastMessage;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { Toast, showToastMessage, escapeHtml };
  }
}());
