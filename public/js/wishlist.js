/* ==================== WISHLIST MANAGEMENT ==================== */

const WISHLIST_KEY = 'ag_wishlist';

function getWishlist() {
  try {
    return JSON.parse(localStorage.getItem(WISHLIST_KEY) || '[]');
  } catch {
    return [];
  }
}

function saveWishlist(wishlist) {
  localStorage.setItem(WISHLIST_KEY, JSON.stringify(wishlist));
  updateWishlistBadge();
}

function isInWishlist(productId) {
  return getWishlist().some(item => item.id === productId);
}

function addToWishlist(product) {
  const wishlist = getWishlist();
  if (!wishlist.some(item => item.id === product.id)) {
    wishlist.push({ id: product.id, name: product.name, price: product.price, emoji: product.emoji || '📿', image: product.image || '' });
    saveWishlist(wishlist);
    showToast('', `${product.name} agregado a favoritos`, 'success');
  }
}

function removeFromWishlist(productId) {
  const wishlist = getWishlist().filter(item => item.id !== productId);
  saveWishlist(wishlist);
}

function updateWishlistBadge() {
  const badge = document.getElementById('wishlistCount');
  if (badge) {
    const count = getWishlist().length;
    badge.textContent = count;
    badge.classList.toggle('show', count > 0);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  updateWishlistBadge();
});

window.addToWishlist = addToWishlist;
window.removeFromWishlist = removeFromWishlist;
window.isInWishlist = isInWishlist;
window.getWishlist = getWishlist;
