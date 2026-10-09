/* ==================== UI.JS ==================== */
/* global openWhatsAppSafe */

// Toast Notification System
function showToast(icon, message, type = 'default', options = {}) {
  const container = document.getElementById('toastContainer');
  if (!container) return;

  const { onRetry, duration } = options;
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  const safeIcon = escapeHtml(String(icon));
  const safeMessage = escapeHtml(String(message));
  toast.innerHTML = `<span class="toast-icon">${safeIcon}</span><div class="toast-body"><div class="toast-message">${safeMessage}</div>${onRetry ? '<button class="toast-retry" type="button">Reintentar</button>' : ''}</div><button class="toast-close" type="button" aria-label="Cerrar">&times;</button>`;
  toast.setAttribute('role', 'status');
  toast.setAttribute('aria-live', 'polite');
  container.appendChild(toast);

  const closeBtn = toast.querySelector('.toast-close');
  const retryBtn = toast.querySelector('.toast-retry');

  function close() {
    toast.style.animation = 'slideOutRight 0.3s ease forwards';
    setTimeout(() => { if (toast.parentNode) toast.remove(); }, 300);
  }

  if (closeBtn) closeBtn.addEventListener('click', close);
  if (retryBtn) retryBtn.addEventListener('click', () => { close(); onRetry(); });

  const ms = duration ?? CONFIG.ANIMATIONS.TOAST_DURATION;
  if (ms > 0) {
    setTimeout(close, ms);
  }
}

/* ==================== TESTIMONIAL LIGHTBOX ==================== */
(function () {
  'use strict';

  var overlay = null;
  var lastFocused = null;
  var keyHandler = null;

  function ensureOverlay() {
    if (overlay) return overlay;
    overlay = document.createElement('div');
    overlay.className = 'lightbox-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-label', 'Imagen ampliada del testimonio');
    overlay.style.display = 'none';
    overlay.innerHTML =
      '<div class="lightbox-card">' +
        '<img class="lightbox-img" alt="" />' +
        '<button type="button" class="lightbox-close" aria-label="Close image lightbox">×</button>' +
      '</div>';
    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) closeLightbox();
    });
    overlay.querySelector('.lightbox-close').addEventListener('click', closeLightbox);
    document.body.appendChild(overlay);
    return overlay;
  }

  function trapFocus() {
    var focusable = Array.from(overlay.querySelectorAll('.lightbox-close, .lightbox-img'))
      .filter(function (el) { return !el.disabled && el.offsetParent !== null; });
    if (!focusable.length) return;
    var first = focusable[0];
    var last = focusable[focusable.length - 1];
    keyHandler = function (e) {
      if (e.key === 'Escape') {
        e.preventDefault();
        closeLightbox();
        return;
      }
      if (e.key !== 'Tab') return;
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', keyHandler);
  }

  function openLightbox(src, alt) {
    var el = ensureOverlay();
    var img = el.querySelector('.lightbox-img');
    img.src = src;
    img.alt = alt || '';
    lastFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    el.classList.add('active');
    el.style.display = '';
    document.body.classList.add('modal-open');
    trapFocus();
    var closeBtn = el.querySelector('.lightbox-close');
    if (closeBtn) closeBtn.focus();
  }

  function closeLightbox() {
    if (!overlay) return;
    overlay.classList.remove('active');
    overlay.style.display = 'none';
    document.body.classList.remove('modal-open');
    if (keyHandler) {
      document.removeEventListener('keydown', keyHandler);
      keyHandler = null;
    }
    if (lastFocused && typeof lastFocused.focus === 'function') {
      lastFocused.focus();
    }
    lastFocused = null;
  }

  window.openTestimonialLightbox = openLightbox;
  window.closeTestimonialLightbox = closeLightbox;
})();

// Reveal Animation on Scroll
// El contenido NUNCA depende de la animación para ser visible: si
// IntersectionObserver no existe, si el usuario prefiere movimiento reducido,
// o si algo falla, todo pasa a visible (fallback a 1,5 s).
function initRevealAnimation() {
  const forceVisible = () => {
    document.querySelectorAll('.reveal:not(.visible)').forEach(el => el.classList.add('visible'));
  };
  try {
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      forceVisible();
      return;
    }
  } catch (e) { /* noop */ }
  if (!('IntersectionObserver' in window)) {
    forceVisible();
    return;
  }
  const revealElements = document.querySelectorAll('.reveal');

  window.revealObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
      }
    });
  }, {
    threshold: CONFIG.ANIMATIONS.REVEAL_THRESHOLD,
    rootMargin: '0px 0px -100px 0px'
  });

  revealElements.forEach(el => window.revealObserver.observe(el));

  // Fallback: tras 1,5 s todo lo .reveal pasa a visible aunque el observer
  // no haya disparado (fetch lento, elemento fuera de viewport, etc.).
  setTimeout(forceVisible, 1500);
}

// Navbar Scroll Effect
function initNavbarScroll() {
  const navbar = document.getElementById('navbar');
  if (!navbar) return;

  window.addEventListener('scroll', () => {
    if (window.scrollY > 50) {
      navbar.classList.add('scrolled');
    } else {
      navbar.classList.remove('scrolled');
    }
  });
}

// Mobile Navbar Toggle
function initMobileNavbar() {
  const toggle = document.getElementById('navbarToggle');
  const menu = document.getElementById('navbarMenu');

  if (!toggle || !menu) return;

  function openMenu() {
    menu.classList.add('active');
    toggle.setAttribute('aria-expanded', 'true');
    const firstLink = menu.querySelector('.nav-link');
    if (firstLink) firstLink.focus();
  }

  function closeMenu() {
    menu.classList.remove('active');
    toggle.setAttribute('aria-expanded', 'false');
    toggle.focus();
  }

  toggle.addEventListener('click', () => {
    const isActive = menu.classList.contains('active');
    if (isActive) {
      closeMenu();
    } else {
      openMenu();
    }
  });

  menu.querySelectorAll('.nav-link').forEach(link => {
    link.addEventListener('click', () => {
      closeMenu();
    });
  });

  document.addEventListener('click', (e) => {
    if (!e.target.closest('.navbar-menu') && !e.target.closest('.navbar-toggle')) {
      if (menu.classList.contains('active')) {
        closeMenu();
      }
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && menu.classList.contains('active')) {
      closeMenu();
    }
  });
}

// Contact Form Handler
function initContactForm() {
  const form = document.getElementById('contactForm');
  if (!form) return;

form.addEventListener('submit', async (e) => {
      e.preventDefault();

      const name = document.getElementById('name').value;
      const email = document.getElementById('email').value;
      const message = document.getElementById('message').value;

      if (!name || !email || !message) {
        showToast('', 'Por favor completa todos los campos', 'error');
        return;
      }

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        showToast('', 'Ingresá un email válido', 'error');
        return;
      }

      const whatsappMessage = `Nuevo mensaje de contacto\n\nNombre: ${name}\nEmail: ${email}\n\nMensaje:\n${message}`;

      try {
        const res = await window.fetchWithRetry(`${CONFIG.API.BASE}/api/contact`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, email, message })
        });
        if (!res) return;
        const data = await res.json();
        if (data && data.ok !== false) {
          showToast('', 'Mensaje enviado con éxito. Nos pondremos en contacto pronto.', 'success');
          form.reset();
          window.open(getWhatsAppLink(whatsappMessage), '_blank');
        } else {
          showToast('', 'Error al enviar el mensaje. Intentá de nuevo.', 'error');
        }
      } catch (err) {
        console.error('Error enviando contacto:', err);
        showToast('', getFetchErrorMessage(err), 'error');
      }
    });
}

// Newsletter Form Handler
function initNewsletterForm() {
   const form = document.getElementById('newsletterForm');
   if (!form) return;

   form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = form.querySelector('input[type="email"]').value;
      const consent = document.getElementById('newsletterConsent');

      if (!email) {
        showToast('', 'Por favor ingresa tu email', 'error');
        return;
      }

      if (!consent?.checked) {
        showToast('', 'Aceptá la política de privacidad para suscribirte', 'error');
        return;
      }

      try {
        const res = await window.fetchWithRetry(`${CONFIG.API.BASE}/api/subscribe`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email })
        });
        if (!res) return;
        const data = await res.json();
        if (data && data.ok !== false) {
          showToast('', 'Te has suscrito al newsletter. ¡Gracias!', 'success');
          form.reset();
        } else {
          showToast('', 'Error al suscribirse. Intentá de nuevo.', 'error');
        }
      } catch (err) {
        console.error('Error suscribiendo:', err);
        showToast('', getFetchErrorMessage(err), 'error');
      }
    });
 }

// Smooth Scroll for Anchor Links
function initSmoothScroll() {
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
      const href = this.getAttribute('href');
      if (href === '#') return;

      const target = document.querySelector(href);
      if (target) {
        e.preventDefault();
        target.scrollIntoView({
          behavior: 'smooth',
          block: 'start'
        });
      }
    });
  });
}

// Filter Products
function initProductFilters() {
  const filterButtons = document.querySelectorAll('.filter-btn');
  if (filterButtons.length === 0) return;

  filterButtons.forEach(btn => {
    btn.addEventListener('click', (e) => {
      filterButtons.forEach(b => b.classList.remove('active'));
      e.target.classList.add('active');

      const category = e.target.dataset.filter;

      if (typeof renderProducts === 'function') {
        if (category === 'all') {
          renderProducts(getProducts());
        } else {
          renderProducts(getProductsByCategory(category));
        }
      }

      const catalog = document.querySelector('.catalog');
      if (catalog) {
        catalog.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  });
}

// ==================== DATA SYNC ====================
const SYNC_INTERVALS = {};
const SYNC_POLL_MS = 15000;
let sseSource = null;
let sseReconnectMs = 2000;
let sseTimer = null;

function scheduleSSESync() {
  if (sseTimer) return;
  sseTimer = setTimeout(() => {
    sseTimer = null;
    initSSESync();
  }, sseReconnectMs);
}

/* eslint-disable-next-line no-unused-vars */
function initSSESync() {
  if (sseSource) return;
  try {
    const url = `${CONFIG.API.BASE}/api/sync`;
    sseSource = new EventSource(url);

    sseSource.addEventListener('products_updated', () => {
      if (typeof fetchProducts === 'function') {
        fetchProducts().then(() => {
          if (typeof renderProducts === 'function') renderProducts(getProducts());
          if (typeof renderFeaturedProducts === 'function') renderFeaturedProducts();
        });
      }
    });

    sseSource.addEventListener('hero_updated', () => {
      if (typeof loadHeroCards === 'function') loadHeroCards();
    });

    sseSource.addEventListener('site_texts_updated', () => {
      if (typeof loadSiteTexts === 'function') loadSiteTexts();
      if (typeof loadHeroCards === 'function') loadHeroCards();
      if (typeof window.loadAboutImages === 'function') window.loadAboutImages();
      if (typeof window.initAboutCarousel === 'function') window.initAboutCarousel();
    });

    sseSource.addEventListener('settings_updated', () => {
      if (typeof loadMpAlias === 'function') loadMpAlias();
      if (typeof loadSiteSettings === 'function') loadSiteSettings();
    });

    sseSource.addEventListener('order_created', () => {
      if (typeof loadOrders === 'function') loadOrders();
      if (typeof loadSalesReport === 'function') loadSalesReport();
    });

    sseSource.addEventListener('order_status_updated', () => {
      if (typeof loadOrders === 'function') loadOrders();
      if (typeof loadSalesReport === 'function') loadSalesReport();
    });

    sseSource.addEventListener('testimonials_updated', () => {
      if (typeof loadTestimonials === 'function') loadTestimonials();
    });

    sseSource.addEventListener('reviews_updated', (e) => {
      if (e.data) {
        try {
          const data = JSON.parse(e.data);
          if (data.productId && typeof loadProduct === 'function') loadProduct();
        } catch (err) { /* noop */ }
      }
    });

    sseSource.addEventListener('carousel_updated', () => {
      if (typeof window.loadAboutImages === 'function') window.loadAboutImages();
    });

    sseSource.onerror = () => {
      // EventSource only auto-reconnects when the server closes the stream
      // with a 2xx. A non-200 (e.g. 401/403) is a HARD failure: the browser
      // stops the stream and we must reconnect ourselves, but never in a
      // tight loop. Distinguish the two cases by status code.
      const status = sseSource.readyState === EventSource.CLOSED ? 0 : sseSource.readyState;
      console.warn('[SSE] Conexión perdida (readyState=' + status + '), reintentando...');
      try { sseSource.close(); } catch (e) { /* noop */ }
      sseSource = null;
      // Backoff: double each failure, capped. Reset on a successful open.
      sseReconnectMs = Math.min(sseReconnectMs * 2, 30000);
      scheduleSSESync();
    };

    sseSource.onopen = () => {
      sseReconnectMs = 2000;
    };
  } catch (e) {
    console.warn('[SSE] No disponible, usando polling');
  }
}

/* eslint-disable-next-line no-unused-vars */
function destroySSESync() {
  if (sseSource) {
    sseSource.close();
    sseSource = null;
  }
}

/* eslint-disable-next-line no-unused-vars */
function startDataSync(key, fn, immediate) {
  if (SYNC_INTERVALS[key]) return;
  if (immediate !== false) {
    try { fn(); } catch (e) { /* noop */ }
  }
  SYNC_INTERVALS[key] = setInterval(() => {
    try { fn(); } catch (e) { /* noop */ }
  }, SYNC_POLL_MS);
}

/* eslint-disable-next-line no-unused-vars */
function stopDataSync(key) {
  if (SYNC_INTERVALS[key]) {
    clearInterval(SYNC_INTERVALS[key]);
    delete SYNC_INTERVALS[key];
  }
}

let syncChannel = null;
function getSyncChannel() {
  if (!syncChannel) {
    try { syncChannel = new BroadcastChannel('app-sync'); } catch (e) { /* noop */ }
  }
  return syncChannel;
}

/* eslint-disable-next-line no-unused-vars */
function emitSync(eventType) {
  const ch = getSyncChannel();
  if (ch) {
    try { ch.postMessage({ type: eventType, ts: Date.now() }); } catch (e) { /* noop */ }
  }
  try { localStorage.setItem('app_sync_ts', String(Date.now())); } catch (e) { /* noop */ }
}

/* eslint-disable-next-line no-unused-vars */
function onSyncMessage(eventType, handler) {
  const ch = getSyncChannel();
  if (ch) {
    ch.addEventListener('message', (ev) => {
      if (ev.data && ev.data.type === eventType) {
        try { handler(ev.data.data); } catch (e) { /* noop */ }
      }
    });
  }
  window.addEventListener('storage', (e) => {
    if (e.key === 'app_sync_ts' && e.newValue) {
      try { handler(); } catch (e) { /* noop */ }
    }
  });
}

// Modal scroll lock
function lockModalScroll() {
  document.body.style.overflow = 'hidden';
  document.body.style.paddingRight = getScrollbarWidth() + 'px';
}

/* eslint-disable-next-line no-unused-vars */
function unlockModalScroll() {
  document.body.style.overflow = '';
  document.body.style.paddingRight = '';
}

function getScrollbarWidth() {
  return window.innerWidth - document.documentElement.clientWidth;
}

/* eslint-disable-next-line no-unused-vars */
function openModalScrollLock(overlayEl, closeFn) {
  if (!overlayEl) return;
  lockModalScroll();
  const handler = (e) => {
    if (e.target === overlayEl) {
      overlayEl.removeEventListener('click', handler);
      if (typeof closeFn === 'function') closeFn();
    }
  };
  overlayEl.addEventListener('click', handler);
  const escHandler = (e) => {
    if (e.key === 'Escape') {
      overlayEl.removeEventListener('click', handler);
      document.removeEventListener('keydown', escHandler);
      if (typeof closeFn === 'function') closeFn();
    }
  };
  document.addEventListener('keydown', escHandler);
}

// Update Cart Count Badge (definido en cart.js)
window.addToCartAndUpdate = function (product) {
  if (typeof window.addToCart === 'function') window.addToCart(product);
  if (typeof window.updateCartBadge === 'function') window.updateCartBadge();
};

// Sakura interaction (Hero)
function initSakuraInteraction() {
  const sakura = document.getElementById('sakura');
  if (!sakura) return;

  document.addEventListener('mousemove', (e) => {
    const { clientX, clientY } = e;

    const centerX = window.innerWidth / 2;
    const centerY = window.innerHeight / 2;

    const rotateX = (clientY - centerY) / 20;
    const rotateY = (centerX - clientX) / 20;

    sakura.style.transform = `perspective(500px) rotateX(${rotateX}deg) rotateY(${rotateY}deg)`;
  });
}

// Initialize Everything on DOM Ready
function initUI() {
  warmBackend();
  initRevealAnimation();
  initNavbarScroll();
  initMobileNavbar();
  initContactForm();
  initNewsletterForm();
  initSmoothScroll();
  initProductFilters();
  if (typeof window.updateCartBadge === 'function') window.updateCartBadge();
  initSakuraInteraction();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initUI);
} else {
  initUI();
}

// Detectar cambios en el carrito y wishlist (para actualizar en tiempo real entre pestañas y en la misma página)
window.addEventListener('storage', (e) => {
  if (typeof CONFIG !== 'undefined' && CONFIG.CART && e.key === CONFIG.CART.STORAGE_KEY) {
    if (typeof window.updateCartBadge === 'function') window.updateCartBadge();
    if (typeof window.updateCartDisplay === 'function') window.updateCartDisplay();
  }
  if (e.key === 'ag_wishlist') {
    if (typeof updateWishlistBadge === 'function') updateWishlistBadge();
    if (typeof renderWishlist === 'function') renderWishlist();
  }
});

// Catch global de errores fetch para no romper la app
window.addEventListener('unhandledrejection', (event) => {
  const reason = event.reason;
  if (reason && typeof reason === 'object' && reason.message) {
    console.error('Error no capturado:', reason.message);
    if (typeof showToast === 'function') {
      showToast('⚠️', 'Ocurrió un error inesperado. Intentá recargar la página.', 'error');
    }
  }
});

window.addEventListener('error', (event) => {
  const target = event.target;
  if (target && (target.tagName === 'IMG' || target.tagName === 'SCRIPT' || target.tagName === 'LINK' || target.tagName === 'VIDEO' || target.tagName === 'AUDIO')) {
    console.error('[ResourceError]', target.tagName, target.src || target.href);
    if (typeof showToast === 'function') {
      showToast('⚠️', 'No se pudo cargar un recurso. Verificá tu conexión.', 'error', { duration: 3000 });
    }
    event.preventDefault();
  }
});

// Si hay error 404 en fetch, NO redirigir a página 404 del sitio
// (un endpoint API que no existe no debe romper la navegación del frontend)
function getFetchErrorMessage(err) {
  if (navigator.onLine === false) {
    return 'Sin conexión a internet. Verificá tu red.';
  }

  const status = (err && err.status) ? err.status : null;
  const msg = (err && err.message) ? String(err.message) : '';

  if (err && err.name === 'AbortError') {
    return 'El servidor está iniciando, esperá unos segundos.';
  }

  if (status === 502 || status === 503 || status === 504) {
    return 'El servidor está iniciando, esperá unos segundos.';
  }

  if (status === 429) {
    return 'Demasiadas solicitudes. Esperá un minuto y volvé a intentar.';
  }

  if (status === 500) {
    return 'Error del servidor. Intentá de nuevo en unos minutos.';
  }

  if (status === 401 || status === 403) {
    // Surface the actual server error/code so the user (and support) can act
    // instead of getting the opaque "Contactá al administrador" message.
    const serverMsg = (err && (err.serverError || err.error)) ? String(err.serverError || err.error) : '';
    const serverCode = (err && err.serverCode) ? String(err.serverCode) : '';
    const detail = serverCode ? `[${serverCode}] ${serverMsg}`.trim() : serverMsg;
    if (detail) {
      return `Error de autorización: ${detail}. Contactá al administrador.`;
    }
    return 'Error de autorización. Contactá al administrador.';
  }

  if (msg.includes('Failed to fetch') || msg.includes('NetworkError')) {
    return 'No se pudo conectar con el servidor. Verificá tu conexión o intentá de nuevo en unos segundos.';
  }

  if (msg.includes('Timeout') || msg.includes('timeout')) {
    return 'El servidor está iniciando, esperá unos segundos y volvé a intentar.';
  }

  if (status === 400) {
    return 'Error en la solicitud. Verificá los datos e intentá de nuevo.';
  }

  if (status && status >= 400) {
    return `Error del servidor (${status}). Intentá de nuevo en unos minutos.`;
  }

  return 'Error de conexión. Intentá nuevamente.';
}

async function safeFetch(url, opts = {}, timeoutMs = 15000) {
  return fetchWithRetry(url, opts, 3, 1000, timeoutMs);
}

async function fetchWithRetry(url, opts = {}, retries = 3, backoffMs = 1000, timeoutMs = 15000, showToastOnError = true) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const fetchPromise = fetch(url, opts);
      const res = timeoutMs > 0
        ? await Promise.race([
            fetchPromise,
            new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), timeoutMs))
          ])
        : await fetchPromise;
      if (res.status === 404) {
        console.warn('Endpoint no encontrado:', url);
        if (showToastOnError) showToast('', 'Recurso no disponible en este momento.', 'error');
        return null;
      }
      if (!res.ok) {
        // Attach the server's error body/code so callers can surface it.
        const err = new Error(`HTTP ${res.status}: ${res.statusText}`);
        err.status = res.status;
        try {
          const clone = res.clone();
          const body = await clone.text();
          if (body) {
            try {
              const parsed = JSON.parse(body);
              if (parsed && typeof parsed === 'object') {
                if (parsed.error) err.serverError = parsed.error;
                if (parsed.code) err.serverCode = parsed.code;
                if (parsed.message) err.serverError = err.serverError || parsed.message;
              } else {
                err.serverError = body;
              }
            } catch {
              err.serverError = body;
            }
          }
        } catch (e) { /* body already consumed or unavailable */ }
        throw err;
      }
      return res;
    } catch (err) {
      // Only retry transient failures: 5xx, network errors and timeouts.
      // 4xx responses (including 401/403/400) are deterministic client-side
      // or auth problems — retrying them just burns the rate limit and
      // produces a confusing "reintentando..." toast.
      const status = err && err.status;
      const isTransient = !status || status >= 500
        || err.name === 'AbortError'
        || /timeout/i.test(err.message || '')
        || /Failed to fetch|NetworkError/i.test(err.message || '');

      if (attempt === retries || !isTransient) {
        console.error('Fetch error after retries:', err);
        if (showToastOnError) {
          showToast('', getFetchErrorMessage(err), 'error', {
            onRetry: isTransient ? () => fetchWithRetry(url, opts, retries, backoffMs, timeoutMs, showToastOnError) : null,
            duration: 0
          });
        }
        return null;
      }
      console.warn(`Intento ${attempt + 1} fallido para ${url}, reintentando en ${backoffMs}ms...`, err);
      await new Promise(r => setTimeout(r, backoffMs));
      backoffMs *= 2;
    }
  }
}

window.safeFetch = safeFetch;
window.fetchWithRetry = fetchWithRetry;

// Warm-up: despierta al backend (Render free se duerme ~30-60 s) con un ping
// fire-and-forget a /health al cargar la página. Nunca bloquea ni muestra toast.
function warmBackend() {
  try {
    const base = (typeof CONFIG !== 'undefined' && CONFIG.API && CONFIG.API.BASE) ? CONFIG.API.BASE : '';
    fetch(`${base}/api/health`, { cache: 'no-store', keepalive: true }).catch(() => {});
  } catch (e) { /* noop */ }
}
window.warmBackend = warmBackend;
window.showToast = showToast;
window.getFetchErrorMessage = getFetchErrorMessage;
window.escapeHtml = escapeHtml;

function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
window.escapeHtml = escapeHtml;

function unescapeHtml(str) {
  if (typeof str !== 'string') return str;
  return str
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, '\'');
}
window.unescapeHtml = unescapeHtml;

function sanitizeAboutText(raw) {
  if (typeof raw !== 'string') return '';
  let value = raw;
  if (/&lt;/.test(value) || /&gt;/.test(value)) {
    value = unescapeHtml(value);
  }
  const clean = typeof DOMPurify !== 'undefined' ? DOMPurify.sanitize(value) : value;
  if (!clean || /^<(p|div)>\s*(<br\s*\/?>)?\s*<\/\1>$/.test(clean)) {
    return '';
  }
  var match = clean.match(/<p[^>]*>[\s\S]*?<\/p>/i);
  if (match) {
    return match[0];
  }
  return clean;
}
window.sanitizeAboutText = sanitizeAboutText;

async function loadSiteTexts() {
  try {
    const res = await fetchWithRetry(`${CONFIG.API.BASE}/api/site-texts`, {}, 3, 1000, 15000, false);
    if (!res) {
      return;
    }
    const data = await res.json();

    if (data.__updatedAt) {
      window.__siteTextsUpdatedAt = data.__updatedAt;
      delete data.__updatedAt;
    }

    const featureMap = [
      { titleId: 'feature1Title', descId: 'feature1Desc', titleKey: 'feature_1_title', descKey: 'feature_1_desc' },
      { titleId: 'feature2Title', descId: 'feature2Desc', titleKey: 'feature_2_title', descKey: 'feature_2_desc' },
      { titleId: 'feature3Title', descId: 'feature3Desc', titleKey: 'feature_3_title', descKey: 'feature_3_desc' },
      { titleId: 'feature4Title', descId: 'feature4Desc', titleKey: 'feature_4_title', descKey: 'feature_4_desc' }
    ];

    featureMap.forEach(f => {
      const titleEl = document.getElementById(f.titleId);
      const descEl = document.getElementById(f.descId);
      if (titleEl && data[f.titleKey]) titleEl.textContent = data[f.titleKey];
      if (descEl && data[f.descKey]) descEl.textContent = data[f.descKey];
    });

    if (data.process_subtitle && document.querySelector('.how-it-works .section-subtitle')) {
      document.querySelector('.how-it-works .section-subtitle').textContent = data.process_subtitle;
    }

    const processSteps = [
      { titleId: 'processStep1Title', descId: 'processStep1Desc', titleKey: 'process_step_1_title', descKey: 'process_step_1_desc' },
      { titleId: 'processStep2Title', descId: 'processStep2Desc', titleKey: 'process_step_2_title', descKey: 'process_step_2_desc' },
      { titleId: 'processStep3Title', descId: 'processStep3Desc', titleKey: 'process_step_3_title', descKey: 'process_step_3_desc' },
      { titleId: 'processStep4Title', descId: 'processStep4Desc', titleKey: 'process_step_4_title', descKey: 'process_step_4_desc' },
      { titleId: 'processStep5Title', descId: 'processStep5Desc', titleKey: 'process_step_5_title', descKey: 'process_step_5_desc' }
    ];

    processSteps.forEach(step => {
      const titleEl = document.getElementById(step.titleId);
      const descEl = document.getElementById(step.descId);
      if (titleEl && data[step.titleKey]) titleEl.textContent = data[step.titleKey];
      if (descEl && data[step.descKey]) descEl.textContent = data[step.descKey];
    });

    updateStatsFromTexts(data);
  } catch (err) {
    console.error('Error cargando textos del sitio:', err);
    applyAboutFallback();
  }
}

function applyAboutFallback() {
  const aboutText = document.getElementById('aboutText');
  if (aboutText && !aboutText.innerHTML.trim()) {
    aboutText.innerHTML = '<p>En cada pieza dejamos un pedacito de Gualeguay: horas de trabajo manual, materiales elegidos con cuidado y el orgullo de hacer las cosas bien.</p>';
  }
}

function updateStatsFromTexts(data) {
  const statsMap = {
    statClients: { target: 'stat_clients', suffix: '+' },
    statProductsSold: { target: 'stat_products_sold', suffix: '+' },
    statYears: { target: 'stat_years', suffix: '+' },
    statArtesanal: { target: 'stat_artesanal', suffix: '%' }
  };

  Object.keys(statsMap).forEach(id => {
    const el = document.getElementById(id);
    const key = statsMap[id].target;
    const suffix = statsMap[id].suffix;
    if (!el || !data[key]) return;
    const target = parseInt(data[key], 10);
    if (isNaN(target)) return;
    el.setAttribute('data-target', target);
    el.textContent = '0' + suffix;
    if (typeof window.animateCount === 'function') {
      window.animateCount(el);
    }
  });
}

async function loadSiteSettings() {
  try {
    const res = await fetchWithRetry(`${CONFIG.API.BASE}/api/site-settings`, {}, 3, 1000, 15000, false);
    if (!res) return;
    const settings = await res.json();

    const instagramLink = document.getElementById('instagramLink');
    if (instagramLink) {
      const igUrl = settings.instagram && settings.instagram !== '#' ? settings.instagram : '';
      if (igUrl) {
        instagramLink.href = igUrl;
        instagramLink.style.display = '';
      } else {
        instagramLink.style.display = 'none';
      }
    }

    const facebookLink = document.getElementById('facebookLink');
    if (facebookLink) {
      const fbUrl = settings.facebook && settings.facebook !== '#' ? settings.facebook : '';
      if (fbUrl) {
        facebookLink.href = fbUrl;
        facebookLink.style.display = '';
      } else {
        facebookLink.style.display = 'none';
      }
    }

    const twitterLink = document.getElementById('twitterLink');
    if (twitterLink) {
      const twUrl = settings.twitter && settings.twitter !== '#' ? settings.twitter : '';
      if (twUrl) {
        twitterLink.href = twUrl;
        twitterLink.style.display = '';
      } else {
        twitterLink.style.display = 'none';
      }
    }

    updateContactFromSettings(settings);
  } catch (err) {
    console.error('Error cargando settings:', err);
  }
}

function updateContactFromSettings(settings) {
  const phoneEl = document.querySelector('.info-item a[href^="tel:"]');
  const emailEl = document.querySelector('.info-item a[href^="mailto:"]');
  const addressEl = document.querySelector('.info-item p');

  if (phoneEl && settings.phone) {
    phoneEl.textContent = settings.phone;
    phoneEl.href = `tel:${settings.phone.replace(/[^\d+]/g, '')}`;
  }
  if (emailEl && settings.email) {
    emailEl.textContent = settings.email;
    emailEl.href = `mailto:${settings.email}`;
  }
  if (addressEl && settings.address && addressEl.textContent.includes('San Antonio')) {
    addressEl.innerHTML = settings.address.replace(/, /g, '<br>');
  }
}

async function loadTestimonials() {
  const grid = document.getElementById('testimonialsGrid');
  const skeleton = document.getElementById('testimonialsSkeleton');
  const titleEl = document.getElementById('testimonialsTitle');
  const subtitleEl = document.getElementById('testimonialsSubtitle');
  const section = document.getElementById('testimonials');

  if (grid) grid.innerHTML = '';
  if (skeleton) skeleton.style.display = 'block';
  if (titleEl) titleEl.textContent = 'Lo que dicen nuestros clientes';
  if (subtitleEl) subtitleEl.textContent = 'Historias reales de personas que confiaron en nosotros';
  if (section) section.style.display = '';

  try {
    const contentRes = await fetchWithRetry(`${CONFIG.API.BASE}/api/section-content/testimonials`, {}, 3, 1000, 15000, false);
    if (contentRes && contentRes.ok) {
      const content = await contentRes.json();
      if (titleEl && content.title) titleEl.textContent = content.title;
      if (subtitleEl && content.subtitle) subtitleEl.textContent = content.subtitle;
    }
  } catch (err) {
    console.error('[Testimonials] Error cargando contenido de sección:', err);
  }

  try {
    const res = await fetchWithRetry(`${CONFIG.API.BASE}/api/testimonials`, {}, 3, 1000, 15000, false);
    if (!res) {
      if (skeleton) skeleton.style.display = 'none';
      return;
    }
    const testimonials = await res.json();
    if (skeleton) skeleton.style.display = 'none';
    renderTestimonials(testimonials);
  } catch (err) {
    console.error('Error cargando testimonios:', err);
    if (skeleton) skeleton.style.display = 'none';
    if (grid) grid.innerHTML = '<p style="text-align:center;color:var(--text-muted);grid-column:1/-1;">No se pudieron cargar los testimonios.</p>';
  }
}

function renderTestimonials(testimonials) {
  const grid = document.getElementById('testimonialsGrid');
  const section = document.getElementById('testimonials');
  if (!grid) return;

  if (!testimonials.length) {
    grid.innerHTML = '<p style="text-align:center;color:var(--text-muted);grid-column:1/-1;">Aún no hay testimonios.</p>';
    if (section) section.style.display = '';
    return;
  }

  grid.innerHTML = testimonials.map(t => {
    const productImageHtml = t.image
      ? `<div class="testimonial-product-image-wrap" role="button" tabindex="0" aria-label="Ampliar foto de ${escapeHtml(t.name)}">
          <img src="${escapeHtml(t.image)}" alt="${escapeHtml(t.alt || (t.name + ' con su producto'))}" class="testimonial-product-image" loading="lazy" onerror="this.parentElement.style.display='none'" />
          <button type="button" class="testimonial-product-image-zoom" aria-label="Ampliar foto" aria-hidden="true"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="7"></circle><line x1="21" y1="21" x2="16.5" y2="16.5"></line></svg></button>
        </div>`
      : '';
    return `
    <div class="testimonial-card reveal">
      <div class="testimonial-header">
        <div class="testimonial-avatar">😊</div>
        <div>
          <div class="testimonial-name">${escapeHtml(t.name)}</div>
          ${t.role ? `<div style="font-size:0.8rem;color:var(--text-muted);">${escapeHtml(t.role)}</div>` : ''}
        </div>
        <div class="testimonial-rating">${'⭐'.repeat(t.rating)}</div>
      </div>
      <p class="testimonial-comment">${escapeHtml(t.comment)}</p>
      ${productImageHtml}
    </div>
  `;}).join('');

  if (window.revealObserver) {
    grid.querySelectorAll('.reveal').forEach(el => {
      if (!el.classList.contains('visible')) {
        window.revealObserver.observe(el);
      }
    });
  } else {
    grid.querySelectorAll('.reveal').forEach(el => el.classList.add('visible'));
  }

  grid.querySelectorAll('.testimonial-product-image-wrap').forEach(function (wrap) {
    wrap.addEventListener('click', function () {
      const img = wrap.querySelector('.testimonial-product-image');
      if (img && img.src) window.openTestimonialLightbox(img.src, img.alt || 'Imagen del producto');
    });
    wrap.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        const img = wrap.querySelector('.testimonial-product-image');
        if (img && img.src) window.openTestimonialLightbox(img.src, img.alt || 'Imagen del producto');
      }
    });
  });
}

window.loadSiteSettings = loadSiteSettings;
window.loadSiteTexts = loadSiteTexts;
window.loadTestimonials = loadTestimonials;

async function loadPaymentConfig() {
  try {
    const res = await fetchWithRetry(`${CONFIG.API.BASE}/api/payment-config`, {}, 3, 1000, 15000, false);
    if (!res || !res.ok) return;
    const data = await res.json();
    if (data.shippingCost !== undefined) CONFIG.CART.SHIPPING_COST = Number(data.shippingCost);
    if (data.freeShippingFrom !== undefined) CONFIG.CART.SHIPPING_THRESHOLD = Number(data.freeShippingFrom);
  } catch (err) {
    console.error('[Config] Error cargando payment-config:', err);
  }
}
window.loadPaymentConfig = loadPaymentConfig;

if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', () => {
    if (typeof loadSiteSettings === 'function') {
      loadSiteSettings();
    }
    if (typeof loadPaymentConfig === 'function') {
      loadPaymentConfig();
    }
  });
}



/* ==================== GLOBAL ERROR BOUNDARY ==================== */

(function() {
  if (window.__globalErrorHandlerInstalled) return;
  window.__globalErrorHandlerInstalled = true;

  window.onerror = function(message, source, lineno, colno, error) {
    console.error('[GlobalError]', message, 'at', source + ':' + lineno + ':' + colno, error);
    if (typeof showToast === 'function') {
      showToast('⚠️', 'Hubo un problema inesperado. La página se recargará automáticamente.', 'error', { duration: 5000 });
    }
    return false;
  };
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { escapeHtml, unescapeHtml, sanitizeAboutText, getFetchErrorMessage, showToast, safeFetch, fetchWithRetry, initRevealAnimation, initNavbarScroll, initMobileNavbar, initContactForm };
}

if (typeof window !== 'undefined') {
  window.initRevealAnimation = initRevealAnimation;
  window.initNavbarScroll = initNavbarScroll;
  window.initMobileNavbar = initMobileNavbar;
  window.initSSESync = initSSESync;
  window.destroySSESync = destroySSESync;
  window.startDataSync = startDataSync;
  window.stopDataSync = stopDataSync;
  window.emitSync = emitSync;
  window.onSyncMessage = onSyncMessage;
}

// Intercepta clicks en enlaces wa.me para detectar popup bloqueado (Brave, etc.)
(function() {
  if (window.__waBlockInterceptorInstalled) return;
  window.__waBlockInterceptorInstalled = true;

  document.addEventListener('click', function(e) {
    const link = e.target.closest('a[href^="https://wa.me"]');
    if (!link) return;
    if (e.defaultPrevented) return;

    const primary = link.href;
    if (!primary) return;

    const fallback = primary.replace('wa.me/', 'api.whatsapp.com/send?phone=');
    const textMatch = primary.match(/[?&]text=([^&]+)/);
    const message = textMatch ? decodeURIComponent(textMatch[1]) : '';
    const fullFallback = fallback + (message ? '&text=' + encodeURIComponent(message) : '');

    if (typeof openWhatsAppSafe === 'function') {
      e.preventDefault();
      openWhatsAppSafe(primary, fullFallback, null);
      return;
    }

    const opened = window.open(primary, '_blank', 'noopener,noreferrer');
    if (!opened || opened.closed || typeof opened.closed === 'undefined') {
      e.preventDefault();
      window.open(fullFallback, '_blank', 'noopener,noreferrer');
    }
  });
})();

// Intercepta clicks en enlaces de redes sociales sin URL asignada
(function() {
  if (window.__socialPlaceholderInstalled) return;
  window.__socialPlaceholderInstalled = true;

  document.addEventListener('click', function(e) {
    const link = e.target.closest('a[href="#"]');
    if (!link) return;
    const id = link.id || '';
    if (id.includes('instagram') || id.includes('facebook') || id.includes('twitter') || id.includes('social')) {
      e.preventDefault();
      if (typeof showToast === 'function') {
        showToast('📢', 'Red social en desarrollo. Contactanos por WhatsApp.', 'default', { duration: 4000 });
      }
    }
  });
})();
