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
if (typeof loadTestimonials === 'function') {
  loadTestimonials();
}

  function loadAboutImages(attempt) {
    attempt = attempt || 0;
    if (typeof fetchWithRetry !== 'function') return;
    
    console.log('[AboutImages] Cargando imágenes del carrusel (intento ' + attempt + ')');
    fetchWithRetry(CONFIG.API.BASE + '/api/site-texts', {}, 2, 1000).then(function(res) {
      if (!res || !res.ok) {
        console.warn('[AboutImages] Error cargando site-texts:', res ? res.status : 'no response');
        if (attempt < 3) {
          setTimeout(function() { loadAboutImages(attempt + 1); }, 3000);
        }
        return;
      }
      res.json().then(function(texts) {
        console.log('[AboutImages] Raw site-texts response keys:', Object.keys(texts).length);
        window.__aboutImages = {};
        for (var i = 1; i <= 5; i++) {
          var raw = texts['about_image_' + i] || '';
          if (raw) {
            var url = String(raw);
            if (url.startsWith('data:')) {
              window.__aboutImages['about_image_' + i] = url;
            } else if (url.startsWith('http://localhost') || url.startsWith('http://127.0.0.1')) {
              window.__aboutImages['about_image_' + i] = '';
            } else {
              var m = url.match(/\/uploads\/imagenes\/([^/?]+)/);
              window.__aboutImages['about_image_' + i] = m ? '/uploads/imagenes/' + m[1] : url;
            }
          } else {
            window.__aboutImages['about_image_' + i] = '';
          }
        }
        console.log('[AboutImages] Imágenes cargadas:', window.__aboutImages);
        if (typeof window.initAboutCarousel === 'function') {
          window.initAboutCarousel();
        }
      });
    }).catch(function(err) {
      console.error('[AboutImages] Error:', err);
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
