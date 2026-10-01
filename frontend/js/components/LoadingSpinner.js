(function () {
  'use strict';

  function getElement(target) {
    if (!target) return document.body;
    if (typeof target === 'string') return document.querySelector(target);
    return target;
  }

  function showLoading(target, options) {
    options = options || {};
    var container = getElement(target);
    if (!container) return null;
    var spinner = container.querySelector('.loading-spinner');
    if (!spinner) {
      spinner = document.createElement('div');
      spinner.className = 'loading-spinner';
      spinner.setAttribute('role', 'status');
      spinner.setAttribute('aria-live', 'polite');
      var label = document.createElement('span');
      label.className = 'loading-spinner__label';
      label.textContent = options.label || 'Cargando...';
      spinner.appendChild(label);
      if (options.append !== false) container.appendChild(spinner);
    }
    spinner.classList.add('active');
    spinner.style.display = '';
    container.classList.add('is-loading');
    container.setAttribute('aria-busy', 'true');
    return spinner;
  }

  function hideLoading(target) {
    var container = getElement(target);
    if (!container) return false;
    var spinner = container.querySelector('.loading-spinner');
    if (spinner) {
      spinner.classList.remove('active');
      spinner.style.display = 'none';
    }
    container.classList.remove('is-loading');
    container.removeAttribute('aria-busy');
    return true;
  }

  function LoadingSpinner(options) {
    this.options = options || {};
    this.target = this.options.target;
  }
  LoadingSpinner.prototype.show = function () { return showLoading(this.target, this.options); };
  LoadingSpinner.prototype.hide = function () { return hideLoading(this.target); };
  LoadingSpinner.prototype.run = function (promise) {
    this.show();
    return Promise.resolve(promise).finally(function () { this.hide(); }.bind(this));
  };

  window.LoadingSpinner = LoadingSpinner;
  window.showLoading = showLoading;
  window.hideLoading = hideLoading;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { LoadingSpinner, showLoading, hideLoading };
  }
}());
