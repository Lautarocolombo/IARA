(function () {
  'use strict';

  function getElement(target) {
    if (!target) return null;
    return typeof target === 'string' ? document.querySelector(target) : target;
  }

  function initSearchBar(options) {
    options = options || {};
    var root = getElement(options.container) || document.querySelector('.search-bar');
    if (!root) return null;
    var input = getElement(options.input) || root.querySelector('input[type="search"], input[type="text"]');
    var button = getElement(options.button) || root.querySelector('button[type="submit"], button.search-bar__submit');
    var clearButton = getElement(options.clearButton) || root.querySelector('.search-bar__clear');
    var debounceTimer = null;
    var search = function () {
      var value = input ? input.value : '';
      if (typeof options.onSearch === 'function') options.onSearch(value, root);
      root.dispatchEvent(new CustomEvent('search', { detail: { query: value } }));
    };
    if (input) {
      input.addEventListener('input', function () {
        if (clearButton) clearButton.hidden = !input.value;
        if (options.debounce > 0) {
          window.clearTimeout(debounceTimer);
          debounceTimer = window.setTimeout(search, options.debounce);
        } else {
          search();
        }
      });
      input.addEventListener('keydown', function (event) {
        if (event.key === 'Enter') {
          event.preventDefault();
          search();
        }
      });
    }
    if (button) {
      button.addEventListener('click', function (event) {
        event.preventDefault();
        search();
      });
    }
    if (clearButton) {
      clearButton.addEventListener('click', function () {
        if (input) {
          input.value = '';
          input.focus();
        }
        clearButton.hidden = true;
        search();
      });
      clearButton.hidden = !(input && input.value);
    }
    return { search: search, destroy: function () { window.clearTimeout(debounceTimer); } };
  }

  function SearchBar(options) {
    this.options = options || {};
  }
  SearchBar.prototype.init = function () { return initSearchBar(this.options); };

  window.SearchBar = SearchBar;
  window.initSearchBar = initSearchBar;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { SearchBar, initSearchBar };
  }
}());
