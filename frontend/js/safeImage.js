/* ==================== SAFE IMAGE ====================
 * Ultra-robust product-image handling.
 *
 * Guarantees the browser "broken image" icon is NEVER shown by:
 *  - Using a self-contained inline SVG data-URI placeholder
 *    (zero HTTP requests, immune to 404 / CORS / timeout / path issues).
 *  - Guarding onError against infinite loops (handler detach + guard flag).
 *  - Preserving the original <img> node so the container's
 *    aspect-ratio/size (and therefore layout) is unchanged on swap.
 *  - Keeping a meaningful, accessible alt in the fallback.
 *
 * Public API:
 *  - window.renderProductImage(src, alt, opts) -> <img> HTML string
 *  - window.createSafeImage(src, alt, opts)    -> HTMLImageElement
 *  - window.imgError(img, fallback)            -> global onError handler
 *  - window.getPlaceholderDataUri(symbol)      -> cached data-URI string
 */
(function () {
  'use strict';

  var DEFAULT_SYMBOL = '\uD83D  📿'; // 📿
  var _cache = Object.create(null);

  function escapeAttr(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function buildPlaceholderSvg(symbol) {
    var sym = String(symbol || DEFAULT_SYMBOL).replace(/[<>'"&]/g, '') || DEFAULT_SYMBOL;
    var svg =
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200"' +
      ' role="img" aria-label="Imagen no disponible">' +
      '<defs><linearGradient id="agBg" x1="0%" y1="0%" x2="100%" y2="100%">' +
      '<stop offset="0%" stop-color="#fde8ef"/>' +
      '<stop offset="100%" stop-color="#f8d5e4"/>' +
      '</linearGradient></defs>' +
      '<rect width="200" height="200" rx="14" fill="url(#agBg)"/>' +
      '<rect x="42" y="46" width="116" height="76" rx="8" fill="#ffffff" opacity="0.65"' +
      ' stroke="#f4c8d4" stroke-width="1.5" stroke-dasharray="6 5"/>' +
      '<circle cx="74" cy="70" r="6" fill="#d47090" opacity="0.45"/>' +
      '<circle cx="126" cy="70" r="6" fill="#d47090" opacity="0.45"/>' +
      '<circle cx="100" cy="88" r="6" fill="#d47090" opacity="0.45"/>' +
      '<line x1="50" y1="126" x2="150" y2="126" stroke="#e8a0b5" stroke-width="2"' +
      ' stroke-linecap="round"/>' +
      '<text x="100" y="162" text-anchor="middle" font-family="system-ui,serif"' +
      ' font-size="54" dominant-baseline="middle" fill="#d47090" opacity="0.85">' + sym + '</text>' +
      '</svg>';
    return 'data:image/svg+xml,' + encodeURIComponent(svg);
  }

  function getPlaceholderDataUri(symbol) {
    var key = symbol || DEFAULT_SYMBOL;
    if (!_cache[key]) {
      _cache[key] = buildPlaceholderSvg(key);
    }
    return _cache[key];
  }

  window.getPlaceholderDataUri = getPlaceholderDataUri;

  // Global <img> onError handler.
  // imgError(img, fallback?) — `fallback` is an optional emoji glyph.
  // Loop protection: (1) detaches onerror, (2) sets a data-safe-failed flag.
  // The data-URI target can never 404, so the broken icon is impossible.
  window.imgError = function (img, fallback) {
    try {
      if (!img || typeof img !== 'object' || img.tagName !== 'IMG') return;
    } catch (e) {
      return;
    }
    img.onerror = null; // stop re-entrant error events (loop guard #1)
    if (img.getAttribute('data-safe-failed') === '1') return; // guard #2
    img.setAttribute('data-safe-failed', '1');
    var symbol = fallback || img.getAttribute('data-fallback') || DEFAULT_SYMBOL;
    var uri = getPlaceholderDataUri(symbol);
    if (img.getAttribute('src') !== uri) img.setAttribute('src', uri);
    if (!img.getAttribute('alt')) img.setAttribute('alt', 'Producto');
    img.classList.add('img-placeholder');
  };

  // Render an <img> as an HTML string with production-grade attributes:
  //   - escaped src/alt (XSS-safe)
  //   - loading="lazy" (eager when opts.lazy === false)
  //   - decoding="async"
  //   - onerror fallback to the inline SVG placeholder
  //   - empty/invalid src -> inline placeholder src directly (no error flash)
  //
  // opts: { className, style, placeholder(emoji), lazy, id }
   window.renderProductImage = function (src, alt, opts) {
     opts = opts || {};
     var hasSrc = !!(src && String(src).trim());
     var symbol = opts.placeholder || DEFAULT_SYMBOL;
     var attrs = ['<img'];
     attrs.push(' src="' + (hasSrc ? escapeAttr(src) : getPlaceholderDataUri(symbol)) + '"');
     attrs.push(' alt="' + escapeAttr(alt == null ? '' : alt) + '"');
     if (opts.id) attrs.push(' id="' + escapeAttr(opts.id) + '"');
     if (opts.className) attrs.push(' class="' + escapeAttr(opts.className) + '"');
     if (opts.style) attrs.push(' style="' + escapeAttr(opts.style) + '"');
     attrs.push(' loading="' + (opts.lazy === false ? 'eager' : 'lazy') + '"');
     attrs.push(' decoding="async"');
     attrs.push(' data-fallback="' + escapeAttr(symbol) + '"');
     attrs.push(' onerror="window.imgError(this)"');
     attrs.push(' />');
     return attrs.join('');
   };

   window.getProductImageUrl = function (product) {
     if (!product) return '';
     var images = Array.isArray(product.images) ? product.images : [];
     if (images.length) {
       var principal = null;
       for (var i = 0; i < images.length; i++) {
         if (images[i] && images[i].es_principal) { principal = images[i]; break; }
       }
       if (!principal) principal = images[0];
       if (principal && principal.url) {
         var u = String(principal.url).trim();
         if (u) return u;
       }
     }
     if (product.image) {
       var p = String(product.image).trim();
       if (p) return p;
     }
     return '';
   };

  // Programmatic DOM element version (same guarantees, real event listener).
  window.createSafeImage = function (src, alt, opts) {
    opts = opts || {};
    var img = document.createElement('img');
    if (src && String(src).trim()) {
      img.src = src;
    } else {
      img.src = getPlaceholderDataUri(opts.placeholder);
    }
    img.alt = alt == null ? '' : alt;
    if (opts.id) img.id = opts.id;
    if (opts.className) img.className = opts.className;
    if (opts.style) img.setAttribute('style', opts.style);
    img.loading = opts.lazy === false ? 'eager' : 'lazy';
    img.decoding = 'async';
    if (opts.placeholder) img.setAttribute('data-fallback', opts.placeholder);
    img.onerror = function () { window.imgError(img, opts.placeholder); };
    return img;
  };
})();
