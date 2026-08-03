/* ==================== UI.JS ==================== */

// Toast Notification System
function showToast(icon, message, type = 'default') {
  const container = document.getElementById('toastContainer');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `<span>${icon}</span><span>${message}</span>`;
  toast.setAttribute('role', 'status');
  toast.setAttribute('aria-live', 'polite');
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.animation = 'slideInRight 0.3s ease forwards';
  }, 10);

  setTimeout(() => {
    toast.style.animation = 'slideOutRight 0.3s ease forwards';
    setTimeout(() => toast.remove(), 300);
  }, CONFIG.ANIMATIONS.TOAST_DURATION);
}

// Reveal Animation on Scroll
function initRevealAnimation() {
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

  toggle.addEventListener('click', () => {
    menu.classList.toggle('active');
    toggle.setAttribute('aria-expanded', menu.classList.contains('active'));
  });

  menu.querySelectorAll('.nav-link').forEach(link => {
    link.addEventListener('click', () => {
      menu.classList.remove('active');
      toggle.setAttribute('aria-expanded', 'false');
    });
  });

  document.addEventListener('click', (e) => {
    if (!e.target.closest('.navbar-menu') && !e.target.closest('.navbar-toggle')) {
      menu.classList.remove('active');
      toggle.setAttribute('aria-expanded', 'false');
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
        } else {
          showToast('', 'Error al enviar el mensaje. Intentá de nuevo.', 'error');
        }
      } catch (err) {
        console.error('Error enviando contacto:', err);
        showToast('', getFetchErrorMessage(err), 'error');
      }

      window.open(getWhatsAppLink(whatsappMessage), '_blank');
    });
}

// Newsletter Form Handler
function initNewsletterForm() {
   const form = document.getElementById('newsletterForm');
   if (!form) return;

   form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = form.querySelector('input[type="email"]').value;

      if (!email) {
        showToast('', 'Por favor ingresa tu email', 'error');
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

// Update Cart Count Badge (definido en cart.js)
window.addToCartAndUpdate = function (product) {
  if (typeof addToCart === 'function') addToCart(product);
  if (typeof updateCartBadge === 'function') updateCartBadge();
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
document.addEventListener('DOMContentLoaded', () => {
  initRevealAnimation();
  initNavbarScroll();
  initMobileNavbar();
  initContactForm();
  initNewsletterForm();
  initSmoothScroll();
  initProductFilters();
  if (typeof updateCartBadge === 'function') updateCartBadge();
  initSakuraInteraction();
});

// Detectar cambios en el carrito (para actualizar badge en tiempo real)
window.addEventListener('storage', (e) => {
  if (typeof CONFIG !== 'undefined' && CONFIG.CART && e.key === CONFIG.CART.STORAGE_KEY) {
    if (typeof updateCartBadge === 'function') updateCartBadge();
  }
});

// Catch global de errores fetch para no romper la app
window.addEventListener('unhandledrejection', (event) => {
  const reason = event.reason;
  if (reason && typeof reason === 'object' && reason.message) {
    console.error('Error no capturado:', reason.message);
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
    return 'Error de autorización. Contactá al administrador.';
  }

  if (msg.includes('Failed to fetch') || msg.includes('NetworkError')) {
    return 'No se pudo conectar con el servidor. Verificá tu conexión o intentá de nuevo en unos segundos.';
  }

  if (status === 400) {
    return 'Error en la solicitud. Verificá los datos e intentá de nuevo.';
  }

  if (status && status >= 400) {
    return `Error del servidor (${status}). Intentá de nuevo en unos minutos.`;
  }

  return 'Error de conexión. Intentá nuevamente.';
}

async function safeFetch(url, opts = {}) {
  return fetchWithRetry(url, opts, 2, 1000);
}

async function fetchWithRetry(url, opts = {}, retries = 2, backoffMs = 1000) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, opts);
      if (res.status === 404) {
        console.warn('Endpoint no encontrado:', url);
        showToast('', 'Recurso no disponible en este momento.', 'error');
        return null;
      }
      if (!res.ok) {
        const err = new Error(`HTTP ${res.status}: ${res.statusText}`);
        err.status = res.status;
        throw err;
      }
      return res;
    } catch (err) {
      if (attempt === retries) {
        console.error('Fetch error after retries:', err);
        showToast('', getFetchErrorMessage(err), 'error');
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
window.getFetchErrorMessage = getFetchErrorMessage;

async function loadSiteTexts() {
  try {
    const res = await fetchWithRetry(`${CONFIG.API.BASE}/api/site-texts`, {}, 2, 1000);
    if (!res) {
      applyAboutFallback();
      return;
    }
    const data = await res.json();

    if (data.about_text && document.getElementById('aboutText')) {
      document.getElementById('aboutText').innerHTML = `<p>${data.about_text}</p>`;
    } else {
      applyAboutFallback();
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
    const res = await fetchWithRetry(`${CONFIG.API.BASE}/api/site-settings`, {}, 2, 1000);
    if (!res) return;
    const settings = await res.json();

    const instagramLink = document.getElementById('instagramLink');
    if (instagramLink && settings.instagram) {
      instagramLink.href = settings.instagram;
    }

    const facebookLink = document.getElementById('facebookLink');
    if (facebookLink && settings.facebook) {
      facebookLink.href = settings.facebook;
    }

    const twitterLink = document.getElementById('twitterLink');
    if (twitterLink && settings.twitter) {
      twitterLink.href = settings.twitter;
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
  try {
    const res = await fetchWithRetry(`${CONFIG.API.BASE}/api/testimonials`, {}, 2, 1000);
    if (!res) return;
    const testimonials = await res.json();
    renderTestimonials(testimonials);
  } catch (err) {
    console.error('Error cargando testimonios:', err);
  }
}

function renderTestimonials(testimonials) {
  const grid = document.getElementById('testimonialsGrid');
  if (!grid) return;

  if (!testimonials.length) {
    grid.innerHTML = '<p style="text-align:center;color:var(--text-muted);grid-column:1/-1;">Aún no hay testimonios.</p>';
    return;
  }

  grid.innerHTML = testimonials.map(t => `
    <div class="testimonial-card reveal">
      <div class="testimonial-header">
        <div class="testimonial-avatar">${t.avatar || '😊'}</div>
        <div>
          <div class="testimonial-name">${t.name}</div>
          ${t.role ? `<div style="font-size:0.8rem;color:var(--text-muted);">${t.role}</div>` : ''}
        </div>
        <div class="testimonial-rating">${'⭐'.repeat(t.rating)}</div>
      </div>
      <p class="testimonial-comment">${t.comment}</p>
    </div>
  `).join('');

  if (window.revealObserver) {
    grid.querySelectorAll('.reveal').forEach(el => {
      if (!el.classList.contains('visible')) {
        window.revealObserver.observe(el);
      }
    });
  }
}

window.loadSiteSettings = loadSiteSettings;
window.loadSiteTexts = loadSiteTexts;
window.loadHeroCards = loadHeroCards;
window.loadTestimonials = loadTestimonials;

if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', () => {
    if (typeof loadSiteSettings === 'function') {
      loadSiteSettings();
    }
  });
}

async function loadHeroCards() {
  try {
    const res = await fetchWithRetry(`${CONFIG.API.BASE}/api/site-texts`, {}, 2, 1000);
    if (!res) return;
    const data = await res.json();

    const heroCards = [1, 2];
    heroCards.forEach(cardNum => {
      const name = data[`hero_card_${cardNum}_name`];
      const price = data[`hero_card_${cardNum}_price`];
      const image = data[`hero_card_${cardNum}_image`];

      const nameEl = document.getElementById(`heroCard${cardNum}Name`);
      const priceEl = document.getElementById(`heroCard${cardNum}Price`);
      const imgEl = document.getElementById(`heroCard${cardNum}Img`);

      if (nameEl && name) nameEl.textContent = name;
      if (priceEl && price) priceEl.textContent = price;
      if (imgEl && image) {
        imgEl.innerHTML = `<img src="${image}" alt="${name || 'Card imagen'}" style="width:100%;height:100%;object-fit:cover;" />`;
      } else if (imgEl && !image) {
        imgEl.textContent = cardNum === 1 ? '📿' : '💎';
      }
    });
  } catch (err) {
    console.error('Error cargando cards del hero:', err);
  }
}
