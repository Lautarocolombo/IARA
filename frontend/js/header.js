/* eslint-disable no-unused-vars */
/* ==================== SITE HEADER COMPONENT ==================== */

function initSiteHeader(options) {
  options = options || {};

  var showBackButton = options.showBackButton || false;
  var backHref = options.backHref || '../index.html';

  var pathParts = window.location.pathname.split('/');
  var inSubdir = pathParts.length > 2 && pathParts[1] === 'pages';
  var wishlistHref = options.wishlistHref || (inSubdir ? 'wishlist.html' : 'pages/wishlist.html');
  var ordersHref = options.ordersHref || (inSubdir ? '../pages/orders.html' : 'pages/orders.html');
  var adminHref = options.adminHref || (inSubdir ? 'admin.html' : 'pages/admin.html');
  var cartHref = options.cartHref || (inSubdir ? '../pages/cart.html' : 'pages/cart.html');

  var existing = document.getElementById('navbar');
  if (existing) {
    existing.remove();
  }

  var isHome = !showBackButton;

  var nav = document.createElement('nav');
  nav.id = 'navbar';
  nav.className = 'navbar';

  var html = '<div class="navbar-container">';
  html += '<div class="navbar-brand">';
  html += '<a href="' + (isHome ? '#home' : backHref) + '" class="logo">';
  html += '<span class="logo-dot" aria-hidden="true"></span>';
  html += '<span class="logo-text">Artesanía Gualeguay</span>';
  html += '</a>';
  html += '</div>';

  if (isHome) {
    html += '<button class="navbar-toggle" id="navbarToggle" aria-label="Toggle menu">';
    html += '<span></span><span></span><span></span>';
    html += '</button>';
    html += '<ul class="navbar-menu" id="navbarMenu">';
    html += '<li><a href="#home" class="nav-link">Inicio</a></li>';
    html += '<li><a href="#catalog" class="nav-link">Catálogo</a></li>';
    html += '<li><a href="#about" class="nav-link">Sobre Nosotros</a></li>';
    html += '<li><a href="' + ordersHref + '" class="nav-link">Mis pedidos</a></li>';
    html += '<li><a href="#contact" class="nav-link">Contacto</a></li>';
    html += '</ul>';
  } else {
    html += '<a href="' + backHref + '" class="nav-back" aria-label="Volver al inicio">← Volver al inicio</a>';
    html += '<a href="' + ordersHref + '" class="nav-quick-link" style="margin-left:0.75rem;font-size:0.85rem;">Mis pedidos</a>';
    html += '<a href="' + wishlistHref + '" class="nav-quick-link" style="margin-left:0.75rem;font-size:0.85rem;">❤️ Favoritos</a>';
  }

  html += '<div class="navbar-actions">';

  html += '<button id="themeToggle" class="pill-btn pill-btn--theme" title="Cambiar tema" aria-label="Alternar modo claro/oscuro" aria-pressed="false">';
  html += '<div class="pill-btn__theme-track">';
  html += '<span class="pill-btn__theme-icon pill-btn__theme-icon--sun" aria-hidden="true">☀️</span>';
  html += '<span class="pill-btn__theme-icon pill-btn__theme-icon--moon" aria-hidden="true">🌙</span>';
  html += '</div>';
  html += '<div class="pill-btn__theme-slider" aria-hidden="true"></div>';
  html += '</button>';

  html += '<a href="' + wishlistHref + '" id="wishlistToggle" class="pill-btn pill-btn--wishlist pill-btn--md" aria-label="Favoritos" aria-pressed="false" title="Favoritos">';
  html += '<span class="pill-btn__icon">';
  html += '<svg class="pill-btn__heart-fill" viewBox="0 0 24 24" width="20" height="20">';
  html += '<path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>';
  html += '</svg>';
  html += '</span>';
  html += '<span class="pill-btn__badge" id="wishlistCount" aria-live="polite">0</span>';
  html += '</a>';

  html += '<a href="' + adminHref + '" class="pill-btn pill-btn--mascot pill-btn--md" aria-label="Mascota de la marca" title="Panel de Administración">';
  html += '<span class="pill-btn__icon" aria-hidden="true">🐰</span>';
  html += '</a>';

  html += '<a href="' + cartHref + '" class="pill-btn pill-btn--cart pill-btn--md" aria-label="Carrito de compras" title="Ver carrito">';
  html += '<span class="pill-btn__icon">';
  html += '<svg viewBox="0 0 24 24" width="20" height="20">';
  html += '<circle cx="9" cy="21" r="1"></circle>';
  html += '<circle cx="20" cy="21" r="1"></circle>';
  html += '<path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path>';
  html += '</svg>';
  html += '</span>';
  html += '<span class="pill-btn__badge" id="cartCount" aria-live="polite">0</span>';
  html += '</a>';

  html += '</div></div>';

  nav.innerHTML = html;

  var child = document.body.firstChild;
  while (child && child.nodeType === 1 && child.classList.contains('skip-link')) {
    child = child.nextSibling;
  }
  if (child) {
    document.body.insertBefore(nav, child);
  } else {
    document.body.prepend(nav);
  }
}

window.initSiteHeader = initSiteHeader;
window.autoInitSiteHeader = autoInitSiteHeader;

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', autoInitSiteHeader);
} else if (!window.__skipHeaderAutoInit) {
  autoInitSiteHeader();
}

function autoInitSiteHeader() {
  if (window.__siteHeaderInitialized) return;
  var path = window.location.pathname;
  var isHome = path === '/' || path.endsWith('/index.html') || path === '';
  window.__siteHeaderInitialized = true;
  window.initSiteHeader({ showBackButton: !isHome });
}
