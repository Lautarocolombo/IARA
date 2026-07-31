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

// Stats Counter Animation
function initStatsCounter() {
  const statNumbers = document.querySelectorAll('.stat-number[data-target]');
  const animated = new Set();

  const easeOutExpo = (t) => (t === 1 ? 1 : 1 - Math.pow(2, -10 * t));

  const animateCounter = (el) => {
    const target = parseInt(el.getAttribute('data-target'), 10);
    if (isNaN(target) || animated.has(el)) return;
    animated.add(el);

    const duration = 1800;
    const startTime = performance.now();

    const update = (currentTime) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const easedProgress = easeOutExpo(progress);
      const current = Math.floor(easedProgress * target);

      el.textContent = current.toLocaleString('es-AR');

      if (progress < 1) {
        requestAnimationFrame(update);
      } else {
        el.textContent = target.toLocaleString('es-AR');
      }
    };

    requestAnimationFrame(update);
  };

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        animateCounter(entry.target);
        observer.unobserve(entry.target);
      }
    });
  }, {
    threshold: 0.5
  });

  statNumbers.forEach(el => observer.observe(el));
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

  form.addEventListener('submit', (e) => {
    e.preventDefault();

    const name = document.getElementById('name').value;
    const email = document.getElementById('email').value;
    const message = document.getElementById('message').value;

    if (!name || !email || !message) {
      showToast('', 'Por favor completa todos los campos', 'error');
      return;
    }

    const whatsappMessage = `Nuevo mensaje de contacto\n\nNombre: ${name}\nEmail: ${email}\n\nMensaje:\n${message}`;

    showToast('', 'Mensaje enviado con éxito. Nos pondremos en contacto pronto.', 'success');
    form.reset();

    window.open(getWhatsAppLink(whatsappMessage), '_blank');
  });
}

// Newsletter Form Handler
function initNewsletterForm() {
  const form = document.getElementById('newsletterForm');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const emailInput = form.querySelector('input[type="email"]');
    const email = emailInput ? emailInput.value.trim() : '';

    if (!email) {
      showToast('', 'Por favor ingresa tu email', 'error');
      return;
    }

    try {
      const csrfRes = await fetch('${CONFIG.API_BASE_URL}/api/csrf-token');
      const csrfData = await csrfRes.json().catch(() => ({}));
      const headers = { 'Content-Type': 'application/json', ...(csrfData.csrfToken ? { 'X-CSRF-Token': csrfData.csrfToken } : {}) };
      const res = await fetch('${CONFIG.API_BASE_URL}/api/subscribers/subscribe', {
        method: 'POST',
        headers,
        body: JSON.stringify({ email })
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || 'Error al suscribir');
      }

      showToast('', 'Te has suscrito al newsletter. ¡Gracias!', 'success');
      form.reset();
    } catch (err) {
      showToast('', err.message || 'Error al suscribir. Intentá de nuevo.', 'error');
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
  initStatsCounter();
  initNavbarScroll();
  initMobileNavbar();
  initContactForm();
  initNewsletterForm();
  initSmoothScroll();
  initProductFilters();
  if (typeof updateCartBadge === 'function') updateCartBadge();
  initSakuraInteraction();
  initShippingQuote();
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

// Si hay error 404 en fetch, redirigir a página 404
async function safeFetch(url, opts = {}) {
  try {
    const res = await fetch(url, opts);
    if (res.status === 404) {
      window.location.href = 'pages/404.html';
      return null;
    }
    return res;
  } catch (err) {
    console.error('Fetch error:', err);
    showToast('', 'Error de conexión. Verificá tu internet.', 'error');
    return null;
  }
}

window.safeFetch = safeFetch;

// Shipping Quote Module
function initShippingQuote() {
  const tabAuto = document.getElementById('tabAuto');
  const tabManual = document.getElementById('tabManual');
  const panelAuto = document.getElementById('panelAuto');
  const panelManual = document.getElementById('panelManual');
  const autoForm = document.getElementById('shippingAutoForm');
  const manualForm = document.getElementById('shippingManualForm');
  const autoResult = document.getElementById('shippingAutoResult');
  const manualResult = document.getElementById('shippingManualResult');
  const summary = document.getElementById('shippingSummary');

  if (!tabAuto || !tabManual) return;

  function switchTab(mode) {
    tabAuto.classList.toggle('active', mode === 'auto');
    tabManual.classList.toggle('active', mode === 'manual');
    panelAuto.classList.toggle('active', mode === 'auto');
    panelManual.classList.toggle('active', mode === 'manual');
  }

  tabAuto.addEventListener('click', () => switchTab('auto'));
  tabManual.addEventListener('click', () => switchTab('manual'));

  if (autoForm) {
    autoForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const zip = document.getElementById('shippingZip').value.trim();
      if (!zip) {
        showToast('', 'Ingresa tu código postal', 'error');
        return;
      }

      const quote = estimateShipping(zip);
      showShippingResult(autoResult, quote, zip);
      updateSummary(quote);
    });
  }

  if (manualForm) {
    manualForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const costInput = document.getElementById('shippingCost').value.trim();
      const cost = parseFloat(costInput);

      if (isNaN(cost) || cost < 0) {
        showToast('', 'Ingresa un costo válido', 'error');
        return;
      }

      const result = { manual: true, cost };
      showShippingResult(manualResult, result);
      updateSummary(result);
    });
  }

  function estimateShipping(zip) {
    const base = 1500;
    const modifiers = {
      '1': 2200, '2': 1900, '3': 2100, '4': 2000,
      '5': 2500, '6': 1800, '7': 2300, '8': 2600,
      '9': 2400
    };
    const firstDigit = zip.charAt(0);
    const rate = modifiers[firstDigit] || 2000;
    return { auto: true, rate, total: base + rate, zip };
  }

  function showShippingResult(container, data, zip) {
    if (!container) return;
    let html = '';
    if (data.auto && zip) {
      html = `Cotización automática para CP <strong>${zip}</strong>: <strong>ARS ${data.total.toLocaleString('es-AR')}</strong> (Base ${data.rate.toLocaleString('es-AR')})`;
    } else if (data.manual) {
      html = `Costo de envío manual: <strong>ARS ${data.cost.toLocaleString('es-AR')}</strong>`;
    }
    container.innerHTML = html;
    container.classList.add('visible');
  }

  function updateSummary(data) {
    if (!summary) return;
    let text = '';
    if (data.auto) {
      text = `Envío automático - CP ${data.zip}: <strong>ARS ${data.total.toLocaleString('es-AR')}</strong>`;
    } else if (data.manual) {
      text = `Envío manual: <strong>ARS ${data.cost.toLocaleString('es-AR')}</strong>`;
    }
    summary.innerHTML = text;
    summary.classList.add('visible');
  }
}

async function loadSiteTexts() {
  try {
    const res = await safeFetch('${CONFIG.API_BASE_URL}/api/site-texts');
    if (!res) return;
    const data = await res.json();

    if (data.about_text && document.getElementById('aboutText')) {
      const p = document.createElement('p');
      p.textContent = data.about_text;
      const aboutEl = document.getElementById('aboutText');
      aboutEl.innerHTML = '';
      aboutEl.appendChild(p);
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
  } catch (err) {
    console.error('Error cargando textos del sitio:', err);
  }
}

window.loadSiteTexts = loadSiteTexts;
