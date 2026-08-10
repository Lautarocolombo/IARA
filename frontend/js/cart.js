/* ==================== CART MANAGEMENT ==================== */

const CART_STORAGE_KEY = CONFIG.CART.STORAGE_KEY;
const SESSION_KEY = 'ag_cart_session';
const API_BASE = CONFIG.API.BASE;

let cart = [];
let sessionToken = '';

function getSessionToken() {
  try {
    let token = localStorage.getItem(SESSION_KEY);
    if (!token) {
      token = 'cart_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2);
      localStorage.setItem(SESSION_KEY, token);
    }
    return token;
  } catch (e) {
    return 'cart_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2);
  }
}

function loadCartFromStorage() {
  try {
    return JSON.parse(localStorage.getItem(CART_STORAGE_KEY) || '[]');
  } catch (e) {
    return [];
  }
}

function saveCartToStorage(items) {
  try {
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
  } catch (e) {
    console.warn('[cart] No se pudo guardar carrito en localStorage:', e);
  }
}

function updateCartBadge() {
  const badge = document.getElementById('cartCount');
  if (badge) {
    const count = cart.reduce((sum, item) => sum + (item.qty || 1), 0);
    badge.textContent = count;
    badge.classList.toggle('show', count > 0);
  }
}

async function syncCartToBackend(items, method = 'POST', endpoint = '/api/cart') {
  const token = getSessionToken();
  sessionToken = token;
  try {
    const res = await window.fetchWithRetry(`${API_BASE}${endpoint}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'X-Session-Token': token
      },
      body: JSON.stringify({ session_token: token, items, ...(method === 'POST' ? {} : {}) })
    });
    if (!res) return null;
    const data = await res.json();
    if (data.sessionToken) sessionToken = data.sessionToken;
    return data;
  } catch (e) {
    console.warn('[cart] Error sincronizando con backend:', e);
    return null;
  }
}

async function loadCart() {
  const token = getSessionToken();
  sessionToken = token;
  try {
    const res = await window.fetchWithRetry(`${API_BASE}/api/cart?session_token=${encodeURIComponent(token)}`, {}, 1, 500);
    if (!res) {
      cart = loadCartFromStorage();
      updateCartBadge();
      return;
    }
    const data = await res.json();
    if (data.sessionToken) sessionToken = data.sessionToken;
    const items = data.items || {};
    cart = Object.values(items).map(it => ({
      id: it.id,
      name: it.name || 'Producto',
      price: Number(it.price || 0),
      qty: Number(it.qty || 1),
      emoji: it.emoji || '📿',
      image: it.image || '',
      stock: it.stock || 0
    }));
    saveCartToStorage(cart);
    updateCartBadge();
  } catch (e) {
    console.warn('[cart] Error cargando carrito:', e);
    cart = loadCartFromStorage();
    updateCartBadge();
  }
}

async function addToCart(product) {
  const existing = cart.find(item => item.id === product.id);
  const productStock = Number(product.stock) > 0 ? Number(product.stock) : Infinity;
  if (existing) {
    const newQty = (existing.qty || 1) + (product.qty || 1);
    if (newQty > productStock) {
      showToast('', `Stock insuficiente para ${product.name}`, 'error');
      return;
    }
    existing.qty = newQty;
  } else {
    const qty = product.qty || 1;
    if (qty > productStock) {
      showToast('', `Stock insuficiente para ${product.name}`, 'error');
      return;
    }
    cart.push({ ...product, qty });
  }
  saveCartToStorage(cart);
  updateCartBadge();
  showToast('', `${product.name} agregado al carrito`, 'success');
  const items = {};
  cart.forEach(item => { items[String(item.id)] = { id: item.id, name: item.name, price: item.price, qty: item.qty, emoji: item.emoji, image: item.image }; });
  syncCartToBackend(items, 'POST', '/api/cart/items');
}

async function updateCartQty(productId, qty) {
  const item = cart.find(item => item.id === productId);
  if (item) {
    const productStock = Number(item.stock) > 0 ? Number(item.stock) : Infinity;
    const newQty = Math.max(1, Number(qty));
    if (newQty > productStock) {
      showToast('', 'Stock insuficiente', 'error');
      return;
    }
    item.qty = newQty;
    saveCartToStorage(cart);
    updateCartBadge();
    const items = {};
    cart.forEach(it => { items[String(it.id)] = { id: it.id, name: it.name, price: it.price, qty: it.qty, emoji: it.emoji, image: it.image }; });
    syncCartToBackend(items, 'PATCH', '/api/cart/items');
  }
  if (typeof updateCartDisplay === 'function') {
    updateCartDisplay();
  }
}

async function removeFromCart(productId) {
  cart = cart.filter(item => item.id !== productId);
  saveCartToStorage(cart);
  updateCartBadge();
  const items = {};
  cart.forEach(item => { items[String(item.id)] = { id: item.id, name: item.name, price: item.price, qty: item.qty, emoji: item.emoji, image: item.image }; });
  syncCartToBackend(items, 'DELETE', '/api/cart/items');
}

function getCart() {
  return cart;
}

async function clearCart() {
  cart = [];
  saveCartToStorage(cart);
  updateCartBadge();
  syncCartToBackend({}, 'DELETE', '/api/cart');
}

document.addEventListener('DOMContentLoaded', () => {
  loadCart();
  updateCartBadge();
});

window.addToCart = addToCart;
window.updateCartQty = updateCartQty;
window.removeFromCart = removeFromCart;
window.clearCart = clearCart;
window.getCart = getCart;
window.loadCart = loadCart;

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { getCart, addToCart, removeFromCart, updateCartQty, clearCart, saveCart, updateCartBadge, loadCart };
}
