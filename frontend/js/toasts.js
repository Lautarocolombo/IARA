(function () {
  'use strict';

  const CONTAINER_ID = 'globalToastContainer';
  let container = null;

  function getContainer() {
    if (!container) {
      container = document.createElement('div');
      container.id = CONTAINER_ID;
      container.className = 'toast-container';
      document.body.appendChild(container);
    }
    return container;
  }

  function show(message, type, options) {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.setAttribute('role', 'alert');
    toast.setAttribute('aria-live', 'polite');

    const icon = getIcon(type);
    const title = getTitle(type);
    toast.innerHTML = `
      <span class="toast-icon" aria-hidden="true">${icon}</span>
      <div class="toast-body">
        <div class="toast-title">${title}</div>
        <div class="toast-message">${escapeHtml(message)}</div>
      </div>
      <button class="toast-close" aria-label="Cerrar notificación">✕</button>
    `;

    const closeBtn = toast.querySelector('.toast-close');
    const remove = () => {
      toast.classList.add('toast-exit');
      setTimeout(() => toast.remove(), 300);
    };

    closeBtn.addEventListener('click', remove);
    getContainer().appendChild(toast);

    const autoClose = options?.autoClose ?? true;
    const duration = options?.duration ?? getDefaultDuration(type);
    if (autoClose && duration > 0) {
      setTimeout(remove, duration);
    }

    return { remove, element: toast };
  }

  function getIcon(type) {
    switch (type) {
      case 'success': return '✅';
      case 'error': return '❌';
      case 'loading': return '⏳';
      case 'warning': return '⚠️';
      default: return 'ℹ️';
    }
  }

  function getTitle(type) {
    switch (type) {
      case 'success': return 'Éxito';
      case 'error': return 'Error';
      case 'loading': return 'Procesando';
      case 'warning': return 'Atención';
      default: return 'Info';
    }
  }

  function getDefaultDuration(type) {
    switch (type) {
      case 'success': return 3500;
      case 'error': return 5000;
      case 'loading': return 0;
      case 'warning': return 4000;
      default: return 3000;
    }
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  window.Toasts = {
    success: (msg, opts) => show(msg, 'success', opts),
    error: (msg, opts) => show(msg, 'error', opts),
    loading: (msg, opts) => show(msg, 'loading', opts),
    warning: (msg, opts) => show(msg, 'warning', opts),
    remove: (toast) => toast?.remove?.()
  };
})();
