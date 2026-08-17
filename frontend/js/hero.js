(function () {
  'use strict';

  function updateGreeting() {
    var greetingEl = document.getElementById('heroGreeting');
    if (!greetingEl) return;

    var hour = new Date().getHours();
    var greeting = 'Buenos Días';
    if (hour >= 12 && hour < 20) {
      greeting = 'Buenas Tardes';
    } else if (hour >= 20 || hour < 6) {
      greeting = 'Buenas Noches';
    }

    greetingEl.textContent = greeting + ' 🌸';
  }

  async function loadHeroCards() {
    try {
      const res = await fetchWithRetry(`${CONFIG.API.BASE}/api/hero-cards`, {}, 2, 1000);
      if (!res) {
        console.warn('[Hero] No se pudo cargar hero-cards (res null)');
        renderHeroCards([]);
        return;
      }
      const cards = await res.json();
      if (!Array.isArray(cards)) {
        renderHeroCards([]);
        return;
      }
      renderHeroCards(cards);
    } catch (err) {
      console.error('[Hero] Error cargando hero cards:', err);
      renderHeroCards([]);
    }
  }

  function sanitizeHtml(str) {
    if (!str) return '';
    if (typeof DOMPurify !== 'undefined') {
      return DOMPurify.sanitize(str, { ALLOWED_TAGS: ['em', 'strong', 'br'] });
    }
    const doc = new DOMParser().parseFromString('<div>' + str + '</div>', 'text/html');
    const allowed = ['EM', 'STRONG', 'BR'];
    const walk = (node) => {
      const children = Array.from(node.childNodes);
      children.forEach(child => {
        if (child.nodeType === Node.ELEMENT_NODE) {
          if (!allowed.includes(child.tagName)) {
            child.replaceWith(...child.childNodes);
          } else {
            while (child.attributes.length > 0) {
              child.removeAttribute(child.attributes[0].name);
            }
            walk(child);
          }
        }
      });
    };
    walk(doc.body.firstChild);
    return doc.body.firstChild.innerHTML;
  }

  async function renderHeroCards(cards) {
    try {
      let siteTexts = {};
      try {
        const res = await fetchWithRetry(`${CONFIG.API.BASE}/api/site-texts`, {}, 2, 1000);
        if (res && res.ok) siteTexts = await res.json();
      } catch (err) {
        console.error('[Hero] Error cargando site-texts:', err);
      }

      updateGreeting(siteTexts);

      let featuredProducts = [];
      try {
        const res = await fetchWithRetry(`${CONFIG.API.BASE}/api/products/featured`, {}, 2, 1000, 0, false);
        if (res && res.ok) featuredProducts = await res.json();
      } catch (err) {
        console.error('[Hero] Error cargando productos destacados:', err);
      }

      const defaults = [
        {
          imagen: '',
          titulo: 'Regalos <em>artesanales</em><br>que cuentan historias',
          subtitulo: 'Regalos artesanales que cuentan historias, souvenirs y llaveros hechos a mano. Cada pieza es única.',
          cta_texto: 'Explorar Catálogo',
          cta_url: '#catalog',
          polaroid_text: 'Hecho con alma en Gualeguay 🌸'
        },
        {
          imagen: '',
          titulo: 'Anillo Cerámica',
          subtitulo: 'Artesanía con alma',
          cta_texto: 'Ver producto',
          cta_url: '#catalog',
          polaroid_text: 'Pieza única para momentos únicos ✨'
        }
      ];

      const card1 = Array.isArray(cards) && cards.length > 0 ? cards[0] : {};
      const card2 = Array.isArray(cards) && cards.length > 1 ? cards[1] : {};

      const featured1 = Array.isArray(featuredProducts) && featuredProducts.length > 0 ? featuredProducts[0] : null;
      const featured2 = Array.isArray(featuredProducts) && featuredProducts.length > 1 ? featuredProducts[1] : null;

      const siteText = (key, fallback) => {
        return siteTexts[key] !== undefined ? siteTexts[key] : fallback;
      };

      const block1 = {
        imagen: featured1?.image || siteTexts.hero_image_url || card1.imagen || '',
        titulo: siteText('hero_card_1_name', siteText('hero_title', card1.titulo || defaults[0].titulo)),
        subtitulo: siteText('hero_card_1_price', siteText('hero_subtitle', card1.subtitulo || defaults[0].subtitulo)),
        cta_texto: siteText('hero_card_1_cta_text', siteText('hero_cta_text', card1.cta_texto || defaults[0].cta_texto)),
        cta_url: siteText('hero_card_1_cta_url', siteText('hero_cta_url', card1.cta_url || defaults[0].cta_url)),
        polaroid_text: siteText('hero_card_1_text', card1.subtitulo || defaults[0].polaroid_text),
        mostrarBoton: false
      };

      const block2 = {
        imagen: featured2 ? featured2.image : (siteTexts.featured_product_image_url || card2.imagen || ''),
        titulo: siteText('featured_product_name', card2.titulo || defaults[1].titulo),
        subtitulo: siteText('featured_product_description', card2.subtitulo || defaults[1].subtitulo),
        cta_texto: siteText('featured_product_cta_text', card2.cta_texto || defaults[1].cta_texto),
        cta_url: siteText('featured_product_cta_url', card2.cta_url || defaults[1].cta_url),
        polaroid_text: siteText('hero_card_2_text', card2.subtitulo || defaults[1].polaroid_text)
      };

      const data = [block1, block2];

      const heroContent = document.querySelector('.hero-content');
      if (heroContent) {
        const subtitleEl = heroContent.querySelector('.hero-subtitle');
        const primaryBtn = heroContent.querySelector('.btn-primary');

        if (subtitleEl && data[0].subtitulo) subtitleEl.textContent = data[0].subtitulo;
        if (primaryBtn && data[0].cta_texto) {
          primaryBtn.textContent = data[0].cta_texto;
          primaryBtn.href = data[0].cta_url || '#catalog';
        }
      }

      const heroVisual = document.getElementById('heroCardsContainer');
      if (heroVisual) {
        const cardsHtml = data.map((card, i) => {
          const imgSrc = card.imagen || '';
          const imgHtml = imgSrc
            ? window.renderProductImage(imgSrc, card.titulo || '', { style: 'width:100%;height:100%;object-fit:cover;' })
            : window.renderProductImage('', card.titulo || '', { style: 'width:100%;height:100%;object-fit:cover;', placeholder: i === 0 ? '📿' : '📿' });

          let html = '<div class="hero-card" data-hero-card="' + (i + 1) + '">';
          html += '<div class="hero-card-img" id="heroCard' + (i + 1) + 'Img">' + imgHtml + '</div>';

          if (card.polaroid_text) {
            html += '<div class="hero-card-text">' + escapeHtml(card.polaroid_text) + '</div>';
          }
          if (card.titulo) {
            html += '<div class="hero-card-title" id="heroCard' + (i + 1) + 'Name">' + sanitizeHtml(card.titulo) + '</div>';
          }
          if (card.subtitulo) {
            html += '<div class="hero-card-price" id="heroCard' + (i + 1) + 'Price">' + escapeHtml(card.subtitulo) + '</div>';
          }
          if (card.cta_texto && card.mostrarBoton !== false) {
            html += '<a href="' + escapeHtml(card.cta_url || '#') + '" class="hero-card-cta">' + escapeHtml(card.cta_texto) + '</a>';
          }

          html += '</div>';
          return html;
        }).join('');

        heroVisual.innerHTML = cardsHtml;
      }
    } catch (err) {
      console.error('[Hero] Error renderizando cards:', err);
    }
  }

  function escapeHtml(str) {
    if (str == null) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  window.loadHeroCards = loadHeroCards;
  window.renderHeroCards = renderHeroCards;
  window.escapeHtml = escapeHtml;
  window.sanitizeHtml = sanitizeHtml;
})();