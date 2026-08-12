'use strict';

(function() {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  function init() {
    if (typeof initNavbarScroll === 'function') initNavbarScroll();
    if (typeof initMobileNavbar === 'function') initMobileNavbar();
  }
})();
