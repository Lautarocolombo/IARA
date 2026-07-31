/* ==================== CONFIG.JS - CONFIGURACIÓN CENTRALIZADA ==================== */

const CONFIG = {
  // Reseñas Google (completar placeid/link cuando lo tengas)
  REVIEWS: {
    GOOGLE_PLACE_ID: '',
    // URL alternativa si ya la tenés completa
    GOOGLE_WRITE_REVIEW_URL: ''
  },

  // Información de contacto
  CONTACT: {
    WHATSAPP: '+5493444634444',
    PHONE: '+54 (3444) 634-4444',
    EMAIL: 'contacto@artesaniagualeguay.com',
    ADDRESS: 'Gualeguay, Entre Ríos, Argentina'
  },

  // Configuración de carrito
  CART: {
    STORAGE_KEY: 'ag_cart',
    SHIPPING_COST: 200,
    SHIPPING_THRESHOLD: 2000,
    FREE_SHIPPING_TEXT: 'Envío Gratis'
  },

  // Configuración de tema
  THEME: {
    STORAGE_KEY: 'ag_theme',
    DEFAULT: 'light',
    OPTIONS: ['light', 'dark']
  },

  // Información del negocio
  BUSINESS: {
    NAME: 'Artesanía Gualeguay',
    SLOGAN: 'Regalos artesanales que cuentan historias',
    LOGO: '🌸',

    YEAR_FOUNDED: 2021
  },

  // Animaciones
  ANIMATIONS: {
    REVEAL_THRESHOLD: 0.15,
    TOAST_DURATION: 3000,
    TRANSITION_SPEED: 0.4
  },

  // URLs externas
  LINKS: {
    INSTAGRAM: '#',
    FACEBOOK: '#',
    TWITTER: '#'
  },

  // URLs externas
  LINKS: {
    INSTAGRAM: '#',
    FACEBOOK: '#',
    TWITTER: '#'
  },

  // API base para modo split (Vercel frontend + Render backend)
  // En producción, configurar la URL del backend en Render.
  // Se sobreescribe dinámicamente desde /api/config si está disponible.
  API_BASE_URL: '',

   // MercadoPago - Cargar desde variable de entorno o usar placeholder
  PAYMENT: {
    PUBLIC_KEY: typeof process !== 'undefined' && process.env ? (process.env.MP_PUBLIC_KEY || 'TEST-MP-XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX') : 'TEST-MP-XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX'
  },

  // Horarios
  HOURS: {
    WEEKDAY: { open: '09:00', close: '18:00' },
    SATURDAY: { open: '10:00', close: '14:00' },
    CLOSED: ['domingo']
  }
};

// Link directo a “Escribir reseña” (Google)
function getGoogleWriteReviewLink(){
  // Si cargan GOOGLE_WRITE_REVIEW_URL, se prioriza.
  if (CONFIG.REVIEWS && CONFIG.REVIEWS.GOOGLE_WRITE_REVIEW_URL) return CONFIG.REVIEWS.GOOGLE_WRITE_REVIEW_URL;
  const placeId = CONFIG.REVIEWS && CONFIG.REVIEWS.GOOGLE_PLACE_ID ? String(CONFIG.REVIEWS.GOOGLE_PLACE_ID).trim() : '';
  if (!placeId) return '#';
  return `https://search.google.com/local/writereview?placeid=${encodeURIComponent(placeId)}`;
}

// Función auxiliar para generar enlace WhatsApp
function getWhatsAppLink(message = '') {
  const phone = CONFIG.CONTACT.WHATSAPP.replace(/[^\d]/g, '');
  const msg = encodeURIComponent(message || 'Hola! Quisiera más información sobre tus productos.');
  return `https://wa.me/${phone}?text=${msg}`;
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

// Exportar para uso en Node.js (si aplica)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { CONFIG, getWhatsAppLink, getMailtoLink, getGoogleWriteReviewLink, formatARS };
}

async function loadRemoteConfig() {
  try {
    const base = (CONFIG.API_BASE_URL || '').replace(/\/$/, '');
    const res = await fetch(`${base}/api/config`);
    if (!res.ok) return;
    const data = await res.json();
    if (data.apiBaseUrl) CONFIG.API_BASE_URL = data.apiBaseUrl;
    if (data.payment?.publicKey) CONFIG.PAYMENT.PUBLIC_KEY = data.payment.publicKey;
    if (data.reviews?.googlePlaceId) CONFIG.REVIEWS.GOOGLE_PLACE_ID = data.reviews.googlePlaceId;
    if (data.reviews?.googleWriteReviewUrl) CONFIG.REVIEWS.GOOGLE_WRITE_REVIEW_URL = data.reviews.googleWriteReviewUrl;
    if (data.business?.name) CONFIG.BUSINESS.NAME = data.business.name;
    if (data.business?.email) CONFIG.CONTACT.EMAIL = data.business.email;
    if (data.business?.whatsapp) CONFIG.CONTACT.WHATSAPP = data.business.whatsapp;
    if (data.business?.instagram) CONFIG.LINKS.INSTAGRAM = data.business.instagram;
    if (data.business?.facebook) CONFIG.LINKS.FACEBOOK = data.business.facebook;
    if (data.business?.twitter) CONFIG.LINKS.TWITTER = data.business.twitter;
    if (data.shipping?.cost) CONFIG.CART.SHIPPING_COST = data.shipping.cost;
    if (data.shipping?.threshold) CONFIG.CART.SHIPPING_THRESHOLD = data.shipping.threshold;
  } catch (e) {
    console.warn('No se pudo cargar config remota:', e.message);
  }
}

if (typeof window !== 'undefined') {
  loadRemoteConfig();
}

