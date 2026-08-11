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

  function renderHeroCards(cards) {
    const card1 = cards.find(c => c.slot === 0) || {};
    const card2 = cards.find(c => c.slot === 1) || {};

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
        titulo: 'Hecho con amor en Gualeguay',
        subtitulo: 'Materiales premium y envíos a todo el país.',
        cta_texto: 'Contactanos',
        cta_url: '#contact'
      }
    ];

    const data = [
      Object.assign({}, defaults[0], card1),
      Object.assign({}, defaults[1], card2)
    ];

    const heroContent = document.querySelector('.hero-content');
    if (heroContent) {
      const titleEl = heroContent.querySelector('h1');
      const subtitleEl = heroContent.querySelector('.hero-subtitle');
      const primaryBtn = heroContent.querySelector('.btn-primary');

      if (titleEl && data[0].titulo) titleEl.innerHTML = data[0].titulo;
      if (subtitleEl && data[0].subtitulo) subtitleEl.textContent = data[0].subtitulo;
      if (primaryBtn && data[0].cta_texto) {
        primaryBtn.textContent = data[0].cta_texto;
        primaryBtn.href = data[0].cta_url || '#catalog';
      }
    }

    const heroVisual = document.getElementById('heroCardsContainer');
    if (heroVisual) {
      heroVisual.innerHTML = data.map((card, i) => {
        const imgSrc = card.imagen || '';
        const imgHtml = imgSrc
          ? `<img src="${escapeHtml(imgSrc)}" alt="${escapeHtml(card.titulo || '')}" loading="lazy" />`
          : '📿';

        return `
          <div class="hero-card" data-hero-card="${i + 1}">
            <div class="hero-card-img" id="heroCard${i + 1}Img">${imgHtml}</div>
            <div class="hero-card-title" id="heroCard${i + 1}Name">${escapeHtml(card.titulo || '')}</div>
            <div class="hero-card-price" id="heroCard${i + 1}Price">${escapeHtml(card.subtitulo || '')}</div>
            <a href="${escapeHtml(card.cta_url || '#')}" class="hero-card-cta">${escapeHtml(card.cta_texto || 'Ver más')}</a>
          </div>
        `;
      }).join('');
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
})();
