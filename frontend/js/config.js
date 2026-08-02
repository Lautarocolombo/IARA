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
    EMAIL: 'chicafittargentina@gmail.com',
    ADDRESS: 'San Antonio Norte 473, Gualeguay, Entre Ríos, Argentina',
    COORDINATES: { lat: -33.1400009, lng: -59.3136349 }
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

  // Analytics
  ANALYTICS: {
    GOOGLE_ID: '',
    FACEBOOK_PIXEL_ID: ''
  },

  // Animaciones
  ANIMATIONS: {
    REVEAL_THRESHOLD: 0.15,
    TOAST_DURATION: 3000,
    TRANSITION_SPEED: 0.4
  },

   // API — usar URLs relativas para aprovechar el rewrite de Vercel
  // (/api/* → Render backend), evitando problemas de CORS y cold starts
  API: {
    BASE: ''
  },

  // URLs externas
  LINKS: {
    INSTAGRAM: '#',
    FACEBOOK: '#',
    TWITTER: '#'
  },

  // La configuración de pago (alias, WhatsApp, mensaje, activo) se obtiene
  // dinámicamente desde /api/payment-config en el backend. No se usa MercadoPago.

  // Horarios
  HOURS: {
    WEEKDAY: { open: '00:00', close: '23:59' },
    SATURDAY: { open: '00:00', close: '23:59' },
    CLOSED: []
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
