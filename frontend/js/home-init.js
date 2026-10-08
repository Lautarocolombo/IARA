'use strict';

if (typeof initSSESync === 'function') initSSESync();

if (typeof loadSiteTexts === 'function') {
  loadSiteTexts();
}
if (typeof loadHeroCards === 'function') {
  loadHeroCards();
}
if (typeof loadTestimonials === 'function') {
  loadTestimonials();
}

  function loadAboutImages() {
    if (typeof fetchWithRetry !== 'function') return;
    fetchWithRetry(CONFIG.API.BASE + '/api/v1/carousel/public', {}, 2, 1000).then(function(res) {
      if (!res || !res.ok) return;
      res.json().then(function(_data) {
        if (typeof window.initAboutCarousel === 'function') {
          window.initAboutCarousel();
        }
      });
    }).catch(function(err) {
      if (typeof console !== 'undefined' && console.error) {
        console.error('[home-init] Error cargando imágenes del carrusel:', err);
      }
      if (typeof window.initAboutCarousel === 'function') {
        window.initAboutCarousel();
      }
    });
    window.loadAboutImages = loadAboutImages;
  }

if (typeof loadAboutImages === 'function') {
  loadAboutImages();
}

startDataSync('hero-cards', loadHeroCards);
startDataSync('site-texts', loadSiteTexts);
startDataSync('testimonials', loadTestimonials);

onSyncMessage('products_updated', () => {
  if (typeof fetchProducts === 'function') {
    fetchProducts().then(() => {
      if (typeof renderProducts === 'function') renderProducts(getProducts());
      if (typeof renderFeaturedProducts === 'function') renderFeaturedProducts();
    });
  }
});

onSyncMessage('site_texts_updated', (_data) => {
  if (typeof loadSiteTexts === 'function') loadSiteTexts();
  if (typeof loadHeroCards === 'function') loadHeroCards();
  if (typeof loadAboutImages === 'function') loadAboutImages();
  if (typeof window.initAboutCarousel === 'function') window.initAboutCarousel();
});

onSyncMessage('settings_updated', () => {
  if (typeof loadSiteSettings === 'function') loadSiteSettings();
});

onSyncMessage('wishlist_updated', () => {
  if (typeof renderWishlist === 'function') renderWishlist();
});

