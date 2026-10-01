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

  function renderBreadcrumbs(options) {
    options = options || {};
    var target = typeof options.container === 'string' ? document.querySelector(options.container) : options.container;
    if (!target) return null;
    var nav = document.createElement('nav');
    nav.className = 'breadcrumb' + (options.className ? ' ' + options.className : '');
    nav.setAttribute('aria-label', options.label || 'Breadcrumb');
    var items = Array.isArray(options.items) ? options.items : [];
    items.forEach(function (item, index) {
      var isLast = index === items.length - 1;
      var wrapper = document.createElement(isLast && !item.href ? 'span' : 'span');
      wrapper.className = 'breadcrumb__item';
      if (item.href && !isLast) {
        var link = document.createElement('a');
        link.href = item.href;
        link.textContent = item.label || '';
        if (item.title) link.title = item.title;
        wrapper.appendChild(link);
      } else {
        var text = document.createElement('span');
        text.textContent = item.label || '';
        if (isLast) text.setAttribute('aria-current', 'page');
        wrapper.appendChild(text);
      }
      nav.appendChild(wrapper);
      if (!isLast) {
        var separator = document.createElement('span');
        separator.className = 'breadcrumb__separator';
        separator.setAttribute('aria-hidden', 'true');
        separator.textContent = options.separator || '/';
        nav.appendChild(separator);
      }
    });
    target.innerHTML = '';
    target.appendChild(nav);
    return nav;
  }

  function initBreadcrumbs(options) {
    return renderBreadcrumbs(options || {});
  }

  function Breadcrumbs(options) {
    this.options = options || {};
  }
  Breadcrumbs.prototype.render = function (overrides) {
    return renderBreadcrumbs(Object.assign({}, this.options, overrides || {}));
  };

  window.Breadcrumbs = Breadcrumbs;
  window.renderBreadcrumbs = renderBreadcrumbs;
  window.initBreadcrumbs = initBreadcrumbs;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { Breadcrumbs, renderBreadcrumbs, initBreadcrumbs, escapeHtml };
  }
}());
