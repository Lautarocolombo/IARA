/* ==================== NAVBAR TOGGLE STATE ==================== */

const NAVBAR_ACTIVE_KEY = 'ag_navbar_active';

const NAV_ITEMS = [
  { id: 'theme', selector: '#themeToggle' },
  { id: 'wishlist', selector: '.wishlist-link' },
  { id: 'admin', selector: '.admin-link' },
  { id: 'cart', selector: '.cart-link' }
];

function getActiveFromStorage() {
  try {
    return localStorage.getItem(NAVBAR_ACTIVE_KEY);
  } catch {
    return null;
  }
}

function setActiveStorage(id) {
  try {
    localStorage.setItem(NAVBAR_ACTIVE_KEY, id);
  } catch {
    // ignore storage errors
  }
}

function clearActive() {
  document.querySelectorAll('.theme-toggle, .wishlist-link, .admin-link, .cart-link').forEach(el => {
    el.classList.remove('active');
  });
}

function setActiveById(id) {
  clearActive();
  const match = NAV_ITEMS.find(item => item.id === id);
  if (!match) return;
  const el = document.querySelector(match.selector);
  if (el) {
    el.classList.add('active');
  }
  setActiveStorage(id);
}

function getCurrentPageId() {
  const path = window.location.pathname;
  if (path.includes('wishlist.html')) return 'wishlist';
  if (path.includes('admin.html')) return 'admin';
  if (path.includes('cart.html') || path.includes('checkout.html')) return 'cart';
  return 'home';
}

function initNavbarToggle() {
  let activeId = getActiveFromStorage();
  if (!activeId) {
    activeId = getCurrentPageId();
  }
  setActiveById(activeId);

  NAV_ITEMS.forEach(item => {
    const el = document.querySelector(item.selector);
    if (!el) return;

    el.addEventListener('click', (e) => {
      const href = el.getAttribute('href');
      if (href && href !== '#' && href !== window.location.pathname) {
        setActiveById(item.id);
        return;
      }

      e.preventDefault();
      setActiveById(item.id);
    });
  });
}

document.addEventListener('DOMContentLoaded', initNavbarToggle);
