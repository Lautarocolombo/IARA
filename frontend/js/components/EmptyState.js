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

  function renderEmptyState(options) {
    options = options || {};
    var target = typeof options.container === 'string' ? document.querySelector(options.container) : options.container;
    if (!target) return null;
    var state = document.createElement('div');
    state.className = 'empty-state' + (options.className ? ' ' + options.className : '');
    state.setAttribute('role', options.role || 'status');
    var icon = document.createElement('div');
    icon.className = 'empty-state__icon';
    icon.setAttribute('aria-hidden', 'true');
    icon.textContent = options.icon || '⌕';
    var title = document.createElement('h3');
    title.className = 'empty-state__title';
    title.textContent = options.title || 'No hay resultados';
    var message = document.createElement('p');
    message.className = 'empty-state__message';
    message.textContent = options.message || 'Intentá nuevamente más tarde.';
    state.appendChild(icon);
    state.appendChild(title);
    state.appendChild(message);
    if (options.action) {
      var action = document.createElement(options.action.href ? 'a' : 'button');
      action.className = options.action.className || 'btn btn-secondary';
      action.textContent = options.action.label || 'Acción';
      if (options.action.href) {
        action.href = options.action.href;
      } else {
        action.type = 'button';
        action.addEventListener('click', function () {
          if (typeof options.action.onClick === 'function') options.action.onClick();
        });
      }
      state.appendChild(action);
    }
    target.innerHTML = '';
    target.appendChild(state);
    return state;
  }

  function EmptyState(options) {
    this.options = options || {};
  }
  EmptyState.prototype.render = function (overrides) {
    return renderEmptyState(Object.assign({}, this.options, overrides || {}));
  };

  window.EmptyState = EmptyState;
  window.renderEmptyState = renderEmptyState;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { EmptyState, renderEmptyState, escapeHtml };
  }
}());
