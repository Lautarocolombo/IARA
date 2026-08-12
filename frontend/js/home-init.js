'use strict';

(function() {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'Store',
    name: 'Artesanía Gualeguay',
    description: 'Pulseras, souvenirs y accesorios hechos a mano en Gualeguay, Entre Ríos',
    url: window.location.origin,
    telephone: '+5493444634444',
    email: 'chicafittargentina@gmail.com',
    address: {
      '@type': 'PostalAddress',
      streetAddress: 'San Antonio Norte 473',
      addressLocality: 'Gualeguay',
      addressRegion: 'Entre Ríos',
      addressCountry: 'AR',
      postalCode: '2840'
    },
    geo: {
      '@type': 'GeoCoordinates',
      latitude: -33.15,
      longitude: -59.32
    },
    openingHours: 'Mo-Fr 09:00-18:00',
    priceRange: '$$',
    sameAs: [
      'https://instagram.com/tu-cuenta',
      'https://facebook.com/tu-pagina'
    ]
  };
  const script = document.createElement('script');
  script.type = 'application/ld+json';
  script.text = JSON.stringify(schema);
  document.head.appendChild(script);
})();

(function() {
  var mapWrapper = document.getElementById('locationMap');
  if (!mapWrapper) return;
  var iframe = mapWrapper.querySelector('iframe');
  var fallback = document.getElementById('mapFallback');
  if (!iframe || !fallback) return;

  var loaded = false;
  var timeout = setTimeout(function() {
    if (!loaded) {
      iframe.style.display = 'none';
      fallback.style.display = 'flex';
    }
  }, 10000);

  iframe.addEventListener('load', function() {
    loaded = true;
    clearTimeout(timeout);
  });

  iframe.addEventListener('error', function() {
    if (!loaded) {
      iframe.style.display = 'none';
      fallback.style.display = 'flex';
    }
  });
})();

if (typeof initSSESync === 'function') initSSESync();

if (typeof loadSiteTexts === 'function') {
  loadSiteTexts();
}
if (typeof loadHeroCards === 'function') {
  loadHeroCards();
}
if (typeof loadHeroImage === 'function') {
  loadHeroImage();
}
if (typeof loadTestimonials === 'function') {
  loadTestimonials();
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

onSyncMessage('site_texts_updated', (data) => {
  if (typeof loadSiteTexts === 'function') loadSiteTexts();
  if (typeof loadHeroCards === 'function') loadHeroCards();
  if (typeof loadHeroImage === 'function') loadHeroImage();
});

onSyncMessage('settings_updated', () => {
  if (typeof loadSiteSettings === 'function') loadSiteSettings();
});

onSyncMessage('wishlist_updated', () => {
  if (typeof renderWishlist === 'function') renderWishlist();
});
