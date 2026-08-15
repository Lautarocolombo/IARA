'use strict';

(function() {
  function init() {
    if (typeof initNavbarScroll === 'function') initNavbarScroll();
    if (typeof initMobileNavbar === 'function') initMobileNavbar();
  }

  window.init = init;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else if (!window.__skipNavbarInit) {
    init();
  }
})();
