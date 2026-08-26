/* ==================== CART MANAGEMENT ==================== */

let cart = [];
try {
  cart = JSON.parse(localStorage.getItem(CONFIG.CART.STORAGE_KEY) || '[]');
} catch (e) {
  console.error('Error leyendo carrito desde localStorage:', e);
  cart = [];
}

function saveCart() {
  localStorage.setItem(CONFIG.CART.STORAGE_KEY, JSON.stringify(cart));
  updateCartBadge();
}

function updateCartBadge() {
  const badge = document.getElementById('cartCount');
  if (badge) {
    const count = cart.reduce((sum, item) => sum + (item.qty || 1), 0);
    badge.textContent = count;
    badge.classList.toggle('show', count > 0);
  }
}

function addToCart(product) {
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
  saveCart();
  showToast('', `${product.name} agregado al carrito`, 'success');
}

function updateCartQty(productId, qty) {
  const item = cart.find(item => item.id === productId);
  if (item) {
    const productStock = Number(item.stock) > 0 ? Number(item.stock) : Infinity;
    const newQty = Math.max(1, Number(qty));
    if (newQty > productStock) {
      showToast('', 'Stock insuficiente', 'error');
      return;
    }
    item.qty = newQty;
    saveCart();
  }
  if (typeof updateCartDisplay === 'function') {
    updateCartDisplay();
  }
}

function removeFromCart(productId) {
  cart = cart.filter(item => item.id !== productId);
  saveCart();
}

function getCart() {
  return cart;
}

function clearCart() {
  cart = [];
  saveCart();
}

document.addEventListener('DOMContentLoaded', () => {
  updateCartBadge();
});

window.addToCart = addToCart;
window.getCart = getCart;
window.removeFromCart = removeFromCart;
window.updateCartQty = updateCartQty;
window.clearCart = clearCart;
window.saveCart = saveCart;
window.updateCartBadge = updateCartBadge;

// Exportar para Node.js (si aplica)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { getCart, addToCart, removeFromCart, updateCartQty, clearCart, saveCart, updateCartBadge };
}
