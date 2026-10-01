(function () {
  'use strict';

  function normalizePage(value, fallback) {
    var page = Number(value);
    return Number.isFinite(page) && page >= 1 ? Math.floor(page) : fallback;
  }

  function renderPagination(options) {
    options = options || {};
    var container = typeof options.container === 'string' ? document.querySelector(options.container) : options.container;
    if (!container) return null;
    var page = normalizePage(options.page, 1);
    var totalPages = normalizePage(options.totalPages || options.pages, 1);
    var onChange = typeof options.onChange === 'function' ? options.onChange : function () {};
    var maxButtons = Number(options.maxButtons) || 7;
    var pages = [];
    if (totalPages <= maxButtons) {
      for (var index = 1; index <= totalPages; index += 1) pages.push(index);
    } else {
      pages.push(1);
      var start = Math.max(2, page - 2);
      var end = Math.min(totalPages - 1, page + 2);
      if (start > 2) pages.push('ellipsis-start');
      for (var item = start; item <= end; item += 1) pages.push(item);
      if (end < totalPages - 1) pages.push('ellipsis-end');
      pages.push(totalPages);
    }
    container.innerHTML = '';
    container.classList.add('pagination');
    container.setAttribute('role', 'navigation');
    container.setAttribute('aria-label', options.label || 'Paginación');
    var previous = document.createElement('button');
    previous.type = 'button';
    previous.className = 'pagination-btn pagination-btn--previous';
    previous.textContent = options.previousLabel || 'Anterior';
    previous.disabled = page <= 1;
    previous.addEventListener('click', function () { onChange(page - 1); });
    container.appendChild(previous);
    pages.forEach(function (value) {
      if (value === 'ellipsis-start' || value === 'ellipsis-end') {
        var ellipsis = document.createElement('span');
        ellipsis.className = 'pagination-ellipsis';
        ellipsis.setAttribute('aria-hidden', 'true');
        ellipsis.textContent = '…';
        container.appendChild(ellipsis);
        return;
      }
      var button = document.createElement('button');
      button.type = 'button';
      button.className = 'pagination-btn' + (value === page ? ' is-active' : '');
      button.textContent = String(value);
      button.setAttribute('aria-label', 'Página ' + value);
      if (value === page) button.setAttribute('aria-current', 'page');
      button.addEventListener('click', function () { onChange(value); });
      container.appendChild(button);
    });
    var next = document.createElement('button');
    next.type = 'button';
    next.className = 'pagination-btn pagination-btn--next';
    next.textContent = options.nextLabel || 'Siguiente';
    next.disabled = page >= totalPages;
    next.addEventListener('click', function () { onChange(page + 1); });
    container.appendChild(next);
    return container;
  }

  function Pagination(options) {
    this.options = options || {};
    this.page = normalizePage(this.options.page, 1);
  }
  Pagination.prototype.render = function (overrides) {
    var options = Object.assign({}, this.options, overrides || {});
    this.page = normalizePage(options.page, this.page);
    return renderPagination(options);
  };
  Pagination.prototype.setPage = function (page) {
    this.page = normalizePage(page, this.page);
    return this.render({ page: this.page });
  };

  window.Pagination = Pagination;
  window.renderPagination = renderPagination;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { Pagination, renderPagination };
  }
}());
