/**
 * Tests unitarios para hero.js
 */

// Mock de CONFIG
global.CONFIG = {
  CART: {
    STORAGE_KEY: 'ag_cart',
    SHIPPING_COST: 200,
    SHIPPING_THRESHOLD: 2000,
    FREE_SHIPPING_TEXT: 'Envío Gratis'
  },
  API: { BASE: '' },
  ANIMATIONS: { TOAST_DURATION: 3000, REVEAL_THRESHOLD: 0.15 }
};

// Mock de DOMPurify
global.DOMPurify = {
  sanitize: (str) => str
};

describe('hero.js', () => {
  let fetchWithRetryMock;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
    fetchWithRetryMock = jest.fn();
    global.fetchWithRetry = fetchWithRetryMock;
    global.renderProductImage = jest.fn(() => '<img src="" alt="product" />');
    document.body.innerHTML = '';
  });

  describe('sanitizeHtml', () => {
    test('devuelve string vacío para input nulo', () => {
      require('../../frontend/js/hero');
      expect(window.sanitizeHtml(null)).toBe('');
      expect(window.sanitizeHtml(undefined)).toBe('');
      expect(window.sanitizeHtml('')).toBe('');
    });

    test('usa DOMPurify cuando está disponible', () => {
      global.DOMPurify = {
        sanitize: jest.fn((str) => 'sanitized:' + str)
      };
      jest.resetModules();
      require('../../frontend/js/hero');
      const result = window.sanitizeHtml('<em>test</em>');
      expect(result).toBe('sanitized:<em>test</em>');
    });

    test('sanitiza HTML sin DOMPurify permitiendo solo etiquetas permitidas', () => {
      global.DOMPurify = undefined;
      jest.resetModules();
      require('../../frontend/js/hero');
      const result = window.sanitizeHtml('<em>test</em><script>alert(1)</script>');
      expect(result).toContain('<em>test</em>');
      expect(result).not.toContain('<script>');
    });

    test('sanitiza strong y br', () => {
      global.DOMPurify = undefined;
      jest.resetModules();
      require('../../frontend/js/hero');
      const result = window.sanitizeHtml('<strong>hola</strong><br/>');
      expect(result).toContain('<strong>hola</strong>');
      expect(result).toContain('<br>');
    });

    test('elimina atributos de etiquetas permitidas', () => {
      global.DOMPurify = undefined;
      jest.resetModules();
      require('../../frontend/js/hero');
      const result = window.sanitizeHtml('<em onclick="alert(1)">test</em>');
      expect(result).not.toContain('onclick');
    });
  });

  describe('escapeHtml', () => {
    test('escapa caracteres especiales', () => {
      require('../../frontend/js/hero');
      expect(window.escapeHtml('<script>')).toBe('&lt;script&gt;');
      expect(window.escapeHtml('a & b')).toBe('a &amp; b');
      expect(window.escapeHtml('"hola"')).toBe('&quot;hola&quot;');
      expect(window.escapeHtml('it\'s')).toBe('it&#39;s');
    });

    test('devuelve string vacío para null', () => {
      require('../../frontend/js/hero');
      expect(window.escapeHtml(null)).toBe('');
    });

    test('convierte números a string', () => {
      require('../../frontend/js/hero');
      expect(window.escapeHtml(123)).toBe('123');
    });
  });

  describe('loadHeroCards', () => {
    test('carga tarjetas desde API', async () => {
      require('../../frontend/js/hero');
      const mockCards = [
        { titulo: 'Card 1', subtitulo: 'Sub 1', cta_texto: 'Ver', cta_url: '#catalog' },
        { titulo: 'Card 2', subtitulo: 'Sub 2', cta_texto: 'Ver', cta_url: '#catalog' }
      ];
      fetchWithRetryMock.mockResolvedValue({
        ok: true,
        json: async () => mockCards
      });

      document.body.innerHTML = '<div class="hero-content"><h1></h1><p class="hero-subtitle"></p><a class="btn-primary"></a></div><div id="heroCardsContainer"></div>';
      await window.loadHeroCards();

      expect(fetchWithRetryMock).toHaveBeenCalledWith('/api/hero-cards', {}, 2, 1000);
    });

    test('maneja error al cargar tarjetas', async () => {
      require('../../frontend/js/hero');
      fetchWithRetryMock.mockRejectedValue(new Error('Network error'));

      document.body.innerHTML = '<div class="hero-content"></div><div id="heroCardsContainer"></div>';
      await window.loadHeroCards();
    });

    test('renderiza array vacío si la respuesta no es array', async () => {
      require('../../frontend/js/hero');
      fetchWithRetryMock.mockResolvedValue({
        ok: true,
        json: async () => 'not array'
      });

      document.body.innerHTML = '<div class="hero-content"></div><div id="heroCardsContainer"></div>';
      await window.loadHeroCards();
    });

    test('maneja respuesta nula', async () => {
      require('../../frontend/js/hero');
      fetchWithRetryMock.mockResolvedValue(null);

      document.body.innerHTML = '<div class="hero-content"></div><div id="heroCardsContainer"></div>';
      await window.loadHeroCards();
    });
  });

  describe('renderHeroCards', () => {
    test('renderiza tarjetas con datos del backend', async () => {
      require('../../frontend/js/hero');
      fetchWithRetryMock.mockResolvedValue({
        ok: true,
        json: async () => ({
          hero_title: 'Título Custom',
          hero_subtitle: 'Subtítulo Custom',
          hero_cta_text: 'Comprar',
          hero_cta_url: '#catalog'
        })
      });

      document.body.innerHTML = `
        <div class="hero-content">
          <h1></h1>
          <p class="hero-subtitle"></p>
          <a class="btn-primary"></a>
        </div>
        <div id="heroCardsContainer"></div>
      `;
      await window.renderHeroCards([]);

      const heroContent = document.querySelector('.hero-content');
      expect(heroContent.querySelector('h1').innerHTML).toContain('Título Custom');
    });

    test('usa defaults cuando no hay datos', async () => {
      require('../../frontend/js/hero');
      fetchWithRetryMock.mockResolvedValue({
        ok: true,
        json: async () => ({})
      });

      document.body.innerHTML = `
        <div class="hero-content">
          <h1></h1>
          <p class="hero-subtitle"></p>
          <a class="btn-primary"></a>
        </div>
        <div id="heroCardsContainer"></div>
      `;
      await window.renderHeroCards([]);

      expect(document.querySelector('.hero-content h1').innerHTML).toContain('artesanales');
    });

    test('usa datos de site-texts cuando están disponibles', async () => {
      require('../../frontend/js/hero');
      fetchWithRetryMock.mockResolvedValue({
        ok: true,
        json: async () => ({
          hero_title: 'Título desde site-texts'
        })
      });

      document.body.innerHTML = `
        <div class="hero-content">
          <h1></h1>
          <p class="hero-subtitle"></p>
          <a class="btn-primary"></a>
        </div>
        <div id="heroCardsContainer"></div>
      `;
      await window.renderHeroCards([]);

      expect(document.querySelector('.hero-content h1').innerHTML).toContain('Título desde site-texts');
    });

    test('renderiza dos tarjetas hero', async () => {
      require('../../frontend/js/hero');
      fetchWithRetryMock.mockResolvedValue({
        ok: true,
        json: async () => ({})
      });

      document.body.innerHTML = `
        <div class="hero-content">
          <h1></h1>
          <p class="hero-subtitle"></p>
          <a class="btn-primary"></a>
        </div>
        <div id="heroCardsContainer"></div>
      `;
      await window.renderHeroCards([
        { titulo: 'Card 1', cta_texto: 'Ver', cta_url: '#catalog' },
        { titulo: 'Card 2', cta_texto: 'Ver', cta_url: '#catalog' }
      ]);

      const heroVisual = document.getElementById('heroCardsContainer');
      expect(heroVisual.innerHTML).toContain('hero-card');
      expect(heroVisual.innerHTML).toContain('hero-card-cta');
    });

    test('maneja error al renderizar tarjetas', async () => {
      require('../../frontend/js/hero');
      fetchWithRetryMock.mockRejectedValue(new Error('Error'));

      document.body.innerHTML = '<div class="hero-content"></div><div id="heroCardsContainer"></div>';
      await window.renderHeroCards([]);
    });

    test('no hace nada si heroCardsContainer no existe', async () => {
      require('../../frontend/js/hero');
      fetchWithRetryMock.mockResolvedValue({
        ok: true,
        json: async () => ({})
      });

      document.body.innerHTML = '<div class="hero-content"></div>';
      await window.renderHeroCards([]);
    });

    test('renderiza imagen principal en heroVisual', async () => {
      require('../../frontend/js/hero');
      fetchWithRetryMock.mockResolvedValue({
        ok: true,
        json: async () => ({})
      });

      document.body.innerHTML = `
        <div class="hero-content">
          <h1></h1>
          <p class="hero-subtitle"></p>
          <a class="btn-primary"></a>
        </div>
        <div id="heroCardsContainer"></div>
      `;
      await window.renderHeroCards([]);

      const heroVisual = document.getElementById('heroCardsContainer');
      expect(heroVisual.innerHTML).toContain('heroCard1Img');
    });

    test('respeta strings vacíos de site-texts sin caer a defaults', async () => {
      require('../../frontend/js/hero');
      fetchWithRetryMock.mockResolvedValue({
        ok: true,
        json: async () => ({
          hero_title: '',
          hero_subtitle: '',
          hero_cta_text: '',
          hero_cta_url: '',
          hero_card_1_text: ''
        })
      });

      document.body.innerHTML = `
        <div class="hero-content">
          <h1></h1>
          <p class="hero-subtitle"></p>
          <a class="btn-primary"></a>
        </div>
        <div id="heroCardsContainer"></div>
      `;
      await window.renderHeroCards([]);

      const heroContent = document.querySelector('.hero-content');
      expect(heroContent.querySelector('h1').innerHTML).not.toContain('artesanales');
      expect(heroContent.querySelector('.hero-subtitle').textContent).toBe('');
      expect(heroContent.querySelector('.btn-primary').textContent).toBe('');
    });

    test('no renderiza elementos vacíos en las tarjetas hero', async () => {
      require('../../frontend/js/hero');
      fetchWithRetryMock.mockResolvedValue({
        ok: true,
        json: async () => ({
          hero_title: '',
          hero_subtitle: '',
          hero_cta_text: '',
          hero_card_1_text: '',
          featured_product_name: '',
          featured_product_description: '',
          featured_product_cta_text: '',
          hero_card_2_text: ''
        })
      });

      document.body.innerHTML = `
        <div class="hero-content">
          <h1></h1>
          <p class="hero-subtitle"></p>
          <a class="btn-primary"></a>
        </div>
        <div id="heroCardsContainer"></div>
      `;
      await window.renderHeroCards([]);

      const heroVisual = document.getElementById('heroCardsContainer');
      expect(heroVisual.querySelectorAll('.hero-card-text').length).toBe(0);
      expect(heroVisual.querySelectorAll('.hero-card-title').length).toBe(0);
      expect(heroVisual.querySelectorAll('.hero-card-price').length).toBe(0);
      expect(heroVisual.querySelectorAll('.hero-card-cta').length).toBe(0);
    });

    test('renderiza solo elementos con valores en las tarjetas hero', async () => {
      require('../../frontend/js/hero');
      fetchWithRetryMock.mockResolvedValue({
        ok: true,
        json: async () => ({
          hero_title: 'Título Custom',
          hero_subtitle: 'Subtítulo Custom',
          hero_cta_text: 'Ver más',
          hero_cta_url: '#catalog',
          hero_card_1_text: 'Frase 1'
        })
      });

      document.body.innerHTML = `
        <div class="hero-content">
          <h1></h1>
          <p class="hero-subtitle"></p>
          <a class="btn-primary"></a>
        </div>
        <div id="heroCardsContainer"></div>
      `;
      await window.renderHeroCards([]);

      const heroVisual = document.getElementById('heroCardsContainer');
      const card1 = heroVisual.querySelector('[data-hero-card="1"]');
      expect(card1.querySelector('.hero-card-text')).not.toBeNull();
      expect(card1.querySelector('.hero-card-title')).not.toBeNull();
      expect(card1.querySelector('.hero-card-price')).not.toBeNull();
      expect(card1.querySelector('.hero-card-cta')).toBeNull();
    });
  });

  describe('window exports', () => {
    test('expone loadHeroCards', () => {
      require('../../frontend/js/hero');
      expect(typeof window.loadHeroCards).toBe('function');
    });

    test('expone renderHeroCards', () => {
      require('../../frontend/js/hero');
      expect(typeof window.renderHeroCards).toBe('function');
    });
  });
});
