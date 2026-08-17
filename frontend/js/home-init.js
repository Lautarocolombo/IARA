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
    sameAs: []
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
if (typeof loadTestimonials === 'function') {
  loadTestimonials();
}

  function loadAboutImages(attempt) {
    attempt = attempt || 0;
    if (typeof fetchWithRetry !== 'function') return;
    
    fetchWithRetry(CONFIG.API.BASE + '/api/carousel', {}, 2, 1000).then(function(res) {
      if (!res || !res.ok) {
        if (attempt < 3) {
          setTimeout(function() { loadAboutImages(attempt + 1); }, 3000);
        }
        return;
      }
      res.json().then(function(data) {
        window.__aboutImages = {};
        var slots = data.slots || {};
        for (var i = 1; i <= 5; i++) {
          var slot = slots[i];
          if (slot && slot.url) {
            window.__aboutImages['about_image_' + i] = slot.url;
          } else {
            window.__aboutImages['about_image_' + i] = '/imagenes/carrucel/' + i + '.jpg';
          }
        }
        if (typeof window.initAboutCarousel === 'function') {
          window.initAboutCarousel();
        }
      });
    }).catch(function() {
      if (attempt < 3) {
        setTimeout(function() { loadAboutImages(attempt + 1); }, 3000);
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

if (typeof window !== 'undefined') {
  window.addEventListener('carousel_updated', function() {
    if (typeof loadAboutImages === 'function') loadAboutImages();
  });
}

onSyncMessage('site_texts_updated', (_data) => {
  if (typeof loadSiteTexts === 'function') loadSiteTexts();
  if (typeof loadHeroCards === 'function') loadHeroCards();
  if (typeof loadAboutImages === 'function') loadAboutImages();
  if (typeof window.initAboutCarousel === 'function') window.initAboutCarousel();
});

onSyncMessage('section_content_updated', (_data) => {
  if (typeof loadTestimonials === 'function') loadTestimonials();
});

onSyncMessage('settings_updated', () => {
  if (typeof loadSiteSettings === 'function') loadSiteSettings();
});

onSyncMessage('wishlist_updated', () => {
  if (typeof renderWishlist === 'function') renderWishlist();
});
