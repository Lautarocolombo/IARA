(function () {
  'use strict';

  async function loadHeroCards() {
    try {
      const res = await fetchWithRetry(`${CONFIG.API.BASE}/api/hero-cards`, {}, 2, 1000);
      if (!res) {
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
      console.error('[loadHeroCards] Error:', err);
      renderHeroCards([]);
    }
  }

  async function loadHeroImage() {
    try {
      const res = await fetchWithRetry(`${CONFIG.API.BASE}/api/site-texts`, {}, 2, 1000);
      if (!res || !res.ok) return;
      const texts = await res.json();
      const imageUrl = texts.hero_image_url || '';
      const imgEl = document.getElementById('heroMainImage');
      if (!imgEl) return;
      if (imageUrl) {
        imgEl.src = imageUrl;
        imgEl.alt = texts.hero_title || 'Imagen destacada';
        imgEl.style.display = 'block';
      } else {
        imgEl.style.display = 'none';
      }
    } catch (err) {
      console.error('[loadHeroImage] Error:', err);
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

      const defaults = [
        {
          imagen: '',
          titulo: 'Regalos <em>artesanales</em> que cuentan historias',
          subtitulo: 'Pulseras, souvenirs y llaveros hechos a mano. Cada pieza es única.',
          cta_texto: 'Explorar Catálogo',
          cta_url: '#catalog'
        },
        {
          imagen: '',
          titulo: 'Anillo Cerámica',
          subtitulo: 'Artesanía con alma',
          cta_texto: 'Ver producto',
          cta_url: '#catalog'
        }
      ];

      const card1 = Array.isArray(cards) && cards.length > 0 ? cards[0] : {};
      const card2 = Array.isArray(cards) && cards.length > 1 ? cards[1] : {};

      const block1 = {
        imagen: siteTexts.hero_image_url || card1.imagen || '',
        titulo: siteTexts.hero_title || card1.titulo || defaults[0].titulo,
        subtitulo: siteTexts.hero_subtitle || card1.subtitulo || defaults[0].subtitulo,
        cta_texto: siteTexts.hero_cta_text || card1.cta_texto || defaults[0].cta_texto,
        cta_url: siteTexts.hero_cta_url || card1.cta_url || defaults[0].cta_url
      };

      const block2 = {
        imagen: siteTexts.featured_product_image_url || card2.imagen || '',
        titulo: siteTexts.featured_product_name || card2.titulo || defaults[1].titulo,
        subtitulo: siteTexts.featured_product_description || card2.subtitulo || defaults[1].subtitulo,
        cta_texto: siteTexts.featured_product_cta_text || card2.cta_texto || defaults[1].cta_texto,
        cta_url: siteTexts.featured_product_cta_url || card2.cta_url || defaults[1].cta_url
      };

      const data = [block1, block2];

      const heroContent = document.querySelector('.hero-content');
      if (heroContent) {
        const titleEl = heroContent.querySelector('h1');
        const subtitleEl = heroContent.querySelector('.hero-subtitle');
        const primaryBtn = heroContent.querySelector('.btn-primary');

        if (titleEl && data[0].titulo) titleEl.innerHTML = sanitizeHtml(data[0].titulo);
        if (subtitleEl && data[0].subtitulo) subtitleEl.textContent = data[0].subtitulo;
        if (primaryBtn && data[0].cta_texto) {
          primaryBtn.textContent = data[0].cta_texto;
          primaryBtn.href = data[0].cta_url || '#catalog';
        }
      }

      const heroVisual = document.getElementById('heroCardsContainer');
      if (heroVisual) {
        const heroMainImage = document.getElementById('heroMainImage');
        const heroMainImageHtml = heroMainImage ? heroMainImage.outerHTML : '';

        const cardsHtml = data.map((card, i) => {
          const imgSrc = card.imagen || '';
          const imgHtml = imgSrc
            ? window.renderProductImage(imgSrc, card.titulo || '', { style: 'width:100%;height:100%;object-fit:cover;' })
            : window.renderProductImage('', card.titulo || '', { style: 'width:100%;height:100%;object-fit:cover;', placeholder: i === 0 ? '📿' : '📿' });

          return `
            <div class="hero-card" data-hero-card="${i + 1}">
              <div class="hero-card-img" id="heroCard${i + 1}Img">${imgHtml}</div>
              <div class="hero-card-title" id="heroCard${i + 1}Name">${sanitizeHtml(card.titulo || '')}</div>
              <div class="hero-card-price" id="heroCard${i + 1}Price">${escapeHtml(card.subtitulo || '')}</div>
              <a href="${escapeHtml(card.cta_url || '#')}" class="hero-card-cta">${escapeHtml(card.cta_texto || 'Ver más')}</a>
            </div>
          `;
        }).join('');

        heroVisual.innerHTML = heroMainImageHtml + cardsHtml;
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
  window.loadHeroImage = loadHeroImage;
  window.escapeHtml = escapeHtml;
  window.sanitizeHtml = sanitizeHtml;
})();