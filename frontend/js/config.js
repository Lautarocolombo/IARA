/* ==================== CONFIG.JS - CONFIGURACIÓN CENTRALIZADA ==================== */

// Valores por defecto (fallback si falla la API)
const DEFAULT_CONFIG = {
REVIEWS: {
    GOOGLE_PLACE_ID: '',
    GOOGLE_WRITE_REVIEW_URL: ''
  },
  CONTACT: {
    WHATSAPP_ALIAS: 'iara-salgueiro',
    PHONE: '+54 (3444) 634-4444',
    EMAIL: 'noreply@artesaniagualeguay.com',
    ADDRESS: 'San Antonio Norte 473, Gualeguay, Entre Ríos, Argentina',
    COORDINATES: { lat: -33.1400009, lng: -59.3136349 },
    GOOGLE_MAPS_API_KEY: ''
  },
  CART: {
    STORAGE_KEY: 'ag_cart',
    SHIPPING_COST: 200,
    SHIPPING_THRESHOLD: 2000,
    FREE_SHIPPING_TEXT: 'Envío Gratis'
  },
  THEME: {
    STORAGE_KEY: 'ag_theme',
    DEFAULT: 'light',
    OPTIONS: ['light', 'dark']
  },
  BUSINESS: {
    NAME: 'Artesanías Gualeguay',
    SLOGAN: 'Regalos artesanales que cuentan historias',
    LOGO: '🌸',
    YEAR_FOUNDED: 2021
  },
  ANALYTICS: {
    GOOGLE_ID: '',
    FACEBOOK_PIXEL_ID: '',
    SENTRY_DSN: ''
  },
  ANIMATIONS: {
    REVEAL_THRESHOLD: 0.15,
    TOAST_DURATION: 3000,
    TRANSITION_SPEED: 0.4
  },
  API: {
    BASE: '',
    BACKEND_URL: '',
    // Prefijo único de la API. El backend responde en /api y /api/v1
    // (compatibilidad); el frontend usa siempre PREFIX.
    PREFIX: '/api'
  },
  PLACEHOLDER: {
    IMAGE: 'assets/placeholder-product.svg'
  },
  LINKS: {
    INSTAGRAM: 'https://www.instagram.com/artesaniagualeguay',
    FACEBOOK: 'https://www.facebook.com/artesaniagualeguay',
    TWITTER: ''
  },
  HOURS: {
    WEEKDAY: { open: '00:00', close: '23:59' },
    SATURDAY: { open: '00:00', close: '23:59' },
    CLOSED: []
  },
  PAYMENT: {}
};

function deepMerge(target, source) {
  const result = { ...target };
  for (const key of Object.keys(source)) {
    if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
      result[key] = deepMerge(target[key] || {}, source[key]);
    } else if (source[key] !== undefined) {
      result[key] = source[key];
    }
  }
  return result;
}

// CONFIG inicial con valores por defecto (síncrono)
let CONFIG = { ...DEFAULT_CONFIG };

let configPromise = null;
let configLoaded = false;

async function loadConfigFromAPI() {
  if (configLoaded) return CONFIG;
  if (configPromise) return configPromise;

  configPromise = (async () => {
    try {
      // Prefijo único: /api/config, con fallback a /api/v1/config por compatibilidad.
      const base = (CONFIG.API && CONFIG.API.BASE) || '';
      const prefix = (CONFIG.API && CONFIG.API.PREFIX) || '/api';
      let res = null;
      try {
        res = await fetch(`${base}${prefix}/config`, { cache: 'no-store' });
      } catch (e) { res = null; }
      if (!res || !res.ok) {
        try {
          res = await fetch(`${base}/api/v1/config`, { cache: 'no-store' });
        } catch (e) { res = null; }
      }
      if (res && res.ok) {
        const apiConfig = await res.json();
        CONFIG = deepMerge(DEFAULT_CONFIG, apiConfig);
        // No permitir que la API pise el prefijo con un valor inválido.
        if (!CONFIG.API || typeof CONFIG.API.PREFIX !== 'string' || !CONFIG.API.PREFIX.startsWith('/')) {
          CONFIG.API = { ...(CONFIG.API || {}), PREFIX: '/api' };
        }
      }
    } catch (err) {
      console.warn('No se pudo cargar config desde API, usando valores por defecto:', err);
    } finally {
      configLoaded = true;
      // Actualizar window.CONFIG para que todos los módulos vean los valores frescos
      if (typeof window !== 'undefined') {
        window.CONFIG = CONFIG;
        try { applyReviewLinks(); } catch (e) { /* noop */ }
        try { applyWhatsAppLinks(); } catch (e) { /* noop */ }
      }
    }
    return CONFIG;
  })();

  return configPromise;
}

// Función para forzar recarga de config
async function reloadConfig() {
  configLoaded = false;
  configPromise = null;
  return loadConfigFromAPI();
}

// Link directo a "Escribir reseña" (Google)
function getGoogleWriteReviewLink() {
  if (CONFIG.REVIEWS && CONFIG.REVIEWS.GOOGLE_WRITE_REVIEW_URL) return CONFIG.REVIEWS.GOOGLE_WRITE_REVIEW_URL;
  const placeId = CONFIG.REVIEWS && CONFIG.REVIEWS.GOOGLE_PLACE_ID ? String(CONFIG.REVIEWS.GOOGLE_PLACE_ID).trim() : '';
  if (!placeId) return '';
  return `https://search.google.com/local/writereview?placeid=${encodeURIComponent(placeId)}`;
}

function isReviewConfigured() {
  return !!getGoogleWriteReviewLink();
}

function applyReviewLinks() {
  if (typeof document === 'undefined') return;
  const url = getGoogleWriteReviewLink();
  document.querySelectorAll('[data-review-link]').forEach(function (el) {
    if (!url) {
      el.style.display = 'none';
      el.setAttribute('aria-hidden', 'true');
    } else {
      el.style.display = '';
      el.removeAttribute('aria-hidden');
      if (el.tagName === 'A') el.href = url;
    }
  });
}

// Unifica todos los links wa.me al número configurado (admin > Contacto o
// env WHATSAPP). Los HTML traen un href de fallback; con JS se reescribe
// SOLO el número (wa.me/<numero>) y se conserva el ?text= de cada link
// (ej: consulta de producto específico).
function applyWhatsAppLinks() {
  if (typeof document === 'undefined') return;
  try {
    const phone = normalizeWhatsAppPhone(CONFIG.CONTACT.WHATSAPP);
    if (!phone) return;
    document.querySelectorAll('a[href*="wa.me/"]').forEach(function (el) {
      const href = el.getAttribute('href') || '';
      const next = href.replace(/wa\.me\/\d+/, 'wa.me/' + phone);
      if (next !== href) el.setAttribute('href', next);
    });
  } catch (e) { /* noop: los fallbacks hardcodeados siguen funcionando */ }
}

function normalizeWhatsAppPhone(phone) {
  let cleaned = String(phone || '').replace(/[^\d]/g, '');
  if (cleaned.startsWith('549')) {
    cleaned = cleaned.slice(3);
  } else if (cleaned.startsWith('54')) {
    cleaned = cleaned.slice(2);
  }
  if (cleaned.startsWith('15')) {
    cleaned = cleaned.slice(2);
  }
  if (cleaned.startsWith('0')) {
    cleaned = cleaned.slice(1);
  }
  if (!cleaned.startsWith('54')) {
    cleaned = `54${cleaned}`;
  }
  if (cleaned.startsWith('54') && !cleaned.startsWith('549')) {
    cleaned = '549' + cleaned.slice(2);
  }
  return cleaned;
}

// Genera un enlace seguro de consulta sin exponer ninguna credencial.
function buildWhatsAppLink({ phone = CONFIG.CONTACT.WHATSAPP, message = '' } = {}) {
  const waPhone = normalizeWhatsAppPhone(phone);
  if (!waPhone) return '';
  const text = encodeURIComponent(message || 'Hola! Quisiera más información sobre tus productos.');
  return `https://wa.me/${waPhone}?text=${text}`;
}

function getWhatsAppLink(message = '') {
  return buildWhatsAppLink({ message });
}

// Helper único para construir URLs de la API: apiUrl('/products').
// Usa CONFIG.API.BASE + CONFIG.API.PREFIX en un solo lugar.
function apiUrl(path) {
  const base = (typeof CONFIG !== 'undefined' && CONFIG.API && CONFIG.API.BASE) ? CONFIG.API.BASE : '';
  const prefix = (typeof CONFIG !== 'undefined' && CONFIG.API && CONFIG.API.PREFIX) ? CONFIG.API.PREFIX : '/api';
  const clean = String(path || '');
  return `${base}${prefix}${clean.startsWith('/') ? clean : '/' + clean}`;
}

// Función auxiliar para enviar email
function getMailtoLink(subject = '', body = '') {
  return `mailto:${CONFIG.CONTACT.EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

// Función auxiliar para formatear precios en pantalla
function formatARS(amount) {
  try {
    return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(Number(amount));
  } catch {
    return '$' + amount;
  }
}

// Abre WhatsApp detectando si el popup fue bloqueado (Brave, etc.)
function openWhatsAppSafe(primaryUrl, fallbackUrl, deeplinkUrl) {
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

  if (isMobile && deeplinkUrl) {
    const link = document.createElement('a');
    link.href = deeplinkUrl;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => {
      window.open(fallbackUrl, '_blank', 'noopener,noreferrer');
    }, 1500);
    return;
  }

  const opened = window.open(primaryUrl, '_blank', 'noopener,noreferrer');
  if (!opened || opened.closed || typeof opened.closed === 'undefined') {
    window.open(fallbackUrl, '_blank', 'noopener,noreferrer');
  }
}

// Cargar config al iniciar (no bloqueante)
if (typeof window !== 'undefined') {
  loadConfigFromAPI();
  if (typeof document !== 'undefined') {
    // Unificar wa.me con los valores por defecto ya; se repite al llegar la API.
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', function () { try { applyWhatsAppLinks(); } catch (e) { /* noop */ } });
    } else {
      try { applyWhatsAppLinks(); } catch (e) { /* noop */ }
    }
  }
  window.CONFIG = CONFIG;
  window.apiUrl = apiUrl;
  window.formatARS = formatARS;
  window.buildWhatsAppLink = buildWhatsAppLink;
  window.normalizeWhatsAppPhone = normalizeWhatsAppPhone;
  window.getWhatsAppLink = getWhatsAppLink;
  window.getMailtoLink = getMailtoLink;
  window.getGoogleWriteReviewLink = getGoogleWriteReviewLink;
  window.isReviewConfigured = isReviewConfigured;
  window.applyReviewLinks = applyReviewLinks;
  window.applyWhatsAppLinks = applyWhatsAppLinks;
  window.openWhatsAppSafe = openWhatsAppSafe;
  window.reloadConfig = reloadConfig;
}

// Exportar para uso en Node.js (si aplica)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { CONFIG, apiUrl, buildWhatsAppLink, getWhatsAppLink, getMailtoLink, getGoogleWriteReviewLink, isReviewConfigured, applyReviewLinks, applyWhatsAppLinks, formatARS, loadConfigFromAPI, reloadConfig };
}

if (typeof jest !== 'undefined') {
  Object.defineProperty(window, 'navigator', {
    value: { userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
    configurable: true,
    writable: true
  });
}