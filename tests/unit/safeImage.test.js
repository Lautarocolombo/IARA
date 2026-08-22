/**
 * Tests unitarios para safeImage.js
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

describe('safeImage.js', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
    document.documentElement.removeAttribute('data-theme');
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('escapeAttr', () => {
    test('escapa comillas dobles', () => {
      require('../../frontend/js/safeImage');
      expect(window.escapeAttr('test"value')).toBe('test&quot;value');
    });

    test('escapa < y >', () => {
      require('../../frontend/js/safeImage');
      expect(window.escapeAttr('<script>')).toBe('&lt;script&gt;');
    });

    test('escapa &', () => {
      require('../../frontend/js/safeImage');
      expect(window.escapeAttr('a & b')).toBe('a &amp; b');
    });

    test('devuelve string vacío para null', () => {
      require('../../frontend/js/safeImage');
      expect(window.escapeAttr(null)).toBe('');
    });

    test('devuelve string vacío para undefined', () => {
      require('../../frontend/js/safeImage');
      expect(window.escapeAttr(undefined)).toBe('');
    });

    test('convierte números a string', () => {
      require('../../frontend/js/safeImage');
      expect(window.escapeAttr(123)).toBe('123');
    });
  });

  describe('getPlaceholderDataUri', () => {
    test('genera data URI válida', () => {
      require('../../frontend/js/safeImage');
      const uri = window.getPlaceholderDataUri();
      expect(uri.startsWith('data:image/svg+xml,')).toBe(true);
    });

    test('usa símbolo personalizado', () => {
      require('../../frontend/js/safeImage');
      const uri = window.getPlaceholderDataUri('💎');
      expect(uri).toContain(encodeURIComponent('💎'));
    });

    test('genera diferentes URIs para dark/light', () => {
      require('../../frontend/js/safeImage');
      const lightUri = window.getPlaceholderDataUri('📿', false);
      const darkUri = window.getPlaceholderDataUri('📿', true);
      expect(lightUri).not.toBe(darkUri);
    });

    test('cachea URIs generadas', () => {
      require('../../frontend/js/safeImage');
      const uri1 = window.getPlaceholderDataUri('📿');
      const uri2 = window.getPlaceholderDataUri('📿');
      expect(uri1).toBe(uri2);
    });
  });

  describe('imgError', () => {
    test('no hace nada si img es null', () => {
      require('../../frontend/js/safeImage');
      expect(() => window.imgError(null)).not.toThrow();
    });

    test('no hace nada si img no es un IMG', () => {
      require('../../frontend/js/safeImage');
      const div = document.createElement('div');
      expect(() => window.imgError(div)).not.toThrow();
    });

    test('retorna silenciosamente si acceder a tagName lanza error', () => {
      require('../../frontend/js/safeImage');
      const fake = {};
      Object.defineProperty(fake, 'tagName', { get() { throw new Error('boom'); } });
      expect(() => window.imgError(fake)).not.toThrow();
    });

    test('detiene re-entrada de error', () => {
      require('../../frontend/js/safeImage');
      const img = document.createElement('img');
      const errorSpy = jest.spyOn(img, 'setAttribute');
      window.imgError(img);
      window.imgError(img);
      expect(errorSpy).toHaveBeenCalledTimes(3);
    });

    test('usa fallback personalizado', () => {
      require('../../frontend/js/safeImage');
      const img = document.createElement('img');
      img.setAttribute('data-fallback', '💎');
      window.imgError(img, '🎁');
      expect(img.getAttribute('src')).toContain(encodeURIComponent('🎁'));
    });

    test('usa data-fallback si no se proporciona fallback', () => {
      require('../../frontend/js/safeImage');
      const img = document.createElement('img');
      img.setAttribute('data-fallback', '⭐');
      window.imgError(img);
      expect(img.getAttribute('src')).toContain(encodeURIComponent('⭐'));
    });

    test('usa símbolo por defecto si no hay fallback', () => {
      require('../../frontend/js/safeImage');
      const img = document.createElement('img');
      window.imgError(img);
      expect(img.getAttribute('src')).toContain(encodeURIComponent('📿'));
    });

    test('agrega alt si no existe', () => {
      require('../../frontend/js/safeImage');
      const img = document.createElement('img');
      window.imgError(img);
      expect(img.getAttribute('alt')).toBe('Producto');
    });

    test('agrega clase img-placeholder', () => {
      require('../../frontend/js/safeImage');
      const img = document.createElement('img');
      window.imgError(img);
      expect(img.classList.contains('img-placeholder')).toBe(true);
    });

    test('no cambia src si ya es el placeholder', () => {
      require('../../frontend/js/safeImage');
      const img = document.createElement('img');
      const uri = window.getPlaceholderDataUri('📿');
      img.setAttribute('src', uri);
      const setAttributeSpy = jest.spyOn(img, 'setAttribute');
      window.imgError(img);
      const srcCalls = setAttributeSpy.mock.calls.filter(call => call[0] === 'src');
      expect(srcCalls.length).toBe(0);
    });
  });

  describe('renderProductImage', () => {
    test('genera HTML string con src', () => {
      require('../../frontend/js/safeImage');
      const html = window.renderProductImage('https://example.com/image.jpg', 'Test');
      expect(html).toContain('src="https://example.com/image.jpg"');
    });

    test('genera HTML con alt', () => {
      require('../../frontend/js/safeImage');
      const html = window.renderProductImage('https://example.com/image.jpg', 'Test Alt');
      expect(html).toContain('alt="Test Alt"');
    });

    test('usa placeholder cuando no hay src', () => {
      require('../../frontend/js/safeImage');
      const html = window.renderProductImage('', 'Test');
      expect(html).toContain('data:image/svg+xml,');
    });

    test('usa placeholder cuando src es whitespace', () => {
      require('../../frontend/js/safeImage');
      const html = window.renderProductImage('   ', 'Test');
      expect(html).toContain('data:image/svg+xml,');
    });

    test('aplica className cuando se proporciona', () => {
      require('../../frontend/js/safeImage');
      const html = window.renderProductImage('https://example.com/image.jpg', 'Test', { className: 'custom-class' });
      expect(html).toContain('class="custom-class"');
    });

    test('aplica style cuando se proporciona', () => {
      require('../../frontend/js/safeImage');
      const html = window.renderProductImage('https://example.com/image.jpg', 'Test', { style: 'width:100px' });
      expect(html).toContain('style="width:100px"');
    });

    test('aplica id cuando se proporciona', () => {
      require('../../frontend/js/safeImage');
      const html = window.renderProductImage('https://example.com/image.jpg', 'Test', { id: 'myImg' });
      expect(html).toContain('id="myImg"');
    });

    test('usa placeholder personalizado', () => {
      require('../../frontend/js/safeImage');
      const html = window.renderProductImage('', 'Test', { placeholder: '💎' });
      expect(html).toContain('data-fallback="💎"');
    });

    test('incluye onerror handler', () => {
      require('../../frontend/js/safeImage');
      const html = window.renderProductImage('https://example.com/image.jpg', 'Test');
      expect(html).toContain('onerror="window.imgError(this)"');
    });

    test('incluye loading lazy por defecto', () => {
      require('../../frontend/js/safeImage');
      const html = window.renderProductImage('https://example.com/image.jpg', 'Test');
      expect(html).toContain('loading="lazy"');
    });

    test('usa loading eager cuando lazy es false', () => {
      require('../../frontend/js/safeImage');
      const html = window.renderProductImage('https://example.com/image.jpg', 'Test', { lazy: false });
      expect(html).toContain('loading="eager"');
    });

    test('incluye decoding async', () => {
      require('../../frontend/js/safeImage');
      const html = window.renderProductImage('https://example.com/image.jpg', 'Test');
      expect(html).toContain('decoding="async"');
    });

    test('escapa caracteres especiales en src', () => {
      require('../../frontend/js/safeImage');
      const html = window.renderProductImage('https://example.com/image.jpg?x=1&y=2', 'Test');
      expect(html).toContain('src="https://example.com/image.jpg?x=1&amp;y=2"');
    });
  });

  describe('getProductImageUrl', () => {
    test('devuelve URL de imagen principal', () => {
      require('../../frontend/js/safeImage');
      const product = {
        images: [
          { url: 'img1.jpg', es_principal: false },
          { url: 'img2.jpg', es_principal: true }
        ]
      };
      expect(window.getProductImageUrl(product)).toBe('img2.jpg');
    });

    test('devuelve primera imagen si no hay principal', () => {
      require('../../frontend/js/safeImage');
      const product = {
        images: [
          { url: 'img1.jpg', es_principal: false },
          { url: 'img2.jpg', es_principal: false }
        ]
      };
      expect(window.getProductImageUrl(product)).toBe('img1.jpg');
    });

    test('devuelve product.image si no hay imágenes', () => {
      require('../../frontend/js/safeImage');
      const product = { image: 'fallback.jpg', images: [] };
      expect(window.getProductImageUrl(product)).toBe('fallback.jpg');
    });

    test('devuelve string vacío si no hay imágenes', () => {
      require('../../frontend/js/safeImage');
      const product = { images: [] };
      expect(window.getProductImageUrl(product)).toBe('');
    });

    test('devuelve string vacío para producto null', () => {
      require('../../frontend/js/safeImage');
      expect(window.getProductImageUrl(null)).toBe('');
    });

    test('devuelve string vacío si la imagen principal no tiene URL', () => {
      require('../../frontend/js/safeImage');
      const product = {
        images: [
          { url: '', es_principal: true }
        ]
      };
      expect(window.getProductImageUrl(product)).toBe('');
    });
  });

  describe('createSafeImage', () => {
    test('crea elemento img con src', () => {
      require('../../frontend/js/safeImage');
      const img = window.createSafeImage('https://example.com/image.jpg', 'Test');
      expect(img.tagName).toBe('IMG');
      expect(img.src).toBe('https://example.com/image.jpg');
    });

    test('crea elemento img con alt', () => {
      require('../../frontend/js/safeImage');
      const img = window.createSafeImage('https://example.com/image.jpg', 'Test Alt');
      expect(img.alt).toBe('Test Alt');
    });

    test('usa placeholder cuando no hay src', () => {
      require('../../frontend/js/safeImage');
      const img = window.createSafeImage('', 'Test');
      expect(img.src.startsWith('data:image/svg+xml,')).toBe(true);
    });

    test('aplica id cuando se proporciona', () => {
      require('../../frontend/js/safeImage');
      const img = window.createSafeImage('https://example.com/image.jpg', 'Test', { id: 'myImg' });
      expect(img.id).toBe('myImg');
    });

    test('aplica className cuando se proporciona', () => {
      require('../../frontend/js/safeImage');
      const img = window.createSafeImage('https://example.com/image.jpg', 'Test', { className: 'custom' });
      expect(img.className).toBe('custom');
    });

    test('configura onerror', () => {
      require('../../frontend/js/safeImage');
      const img = window.createSafeImage('https://example.com/image.jpg', 'Test');
      expect(typeof img.onerror).toBe('function');
    });

    test('usa data-fallback cuando se proporciona placeholder', () => {
      require('../../frontend/js/safeImage');
      const img = window.createSafeImage('https://example.com/image.jpg', 'Test', { placeholder: '💎' });
      expect(img.getAttribute('data-fallback')).toBe('💎');
    });
  });

  describe('cobertura branches adicionales', () => {
    test('simbolo con solo caracteres especiales usa DEFAULT_SYMBOL (linea 34)', () => {
      require('../../frontend/js/safeImage');
      const uri = window.getPlaceholderDataUri('<>\'"&');
      expect(uri).toContain(encodeURIComponent('📿'));
    });

    test('imgError preserva alt existente (linea 88 false)', () => {
      require('../../frontend/js/safeImage');
      const img = document.createElement('img');
      img.alt = 'existing alt';
      window.imgError(img);
      expect(img.getAttribute('alt')).toBe('existing alt');
    });

    test('renderProductImage con alt null (linea 107 true)', () => {
      require('../../frontend/js/safeImage');
      const html = window.renderProductImage('https://example.com/img.jpg', null);
      expect(html).toContain('alt=""');
    });

    test('renderProductImage con alt undefined (linea 107 true)', () => {
      require('../../frontend/js/safeImage');
      const html = window.renderProductImage('https://example.com/img.jpg');
      expect(html).toContain('alt=""');
    });

    test('getProductImageUrl con images no-array (linea 121 false)', () => {
      require('../../frontend/js/safeImage');
      const product = { images: 'not-array', image: 'fallback.jpg' };
      expect(window.getProductImageUrl(product)).toBe('fallback.jpg');
    });

    test('getProductImageUrl con url whitespace (linea 130 false)', () => {
      require('../../frontend/js/safeImage');
      const product = {
        images: [{ url: '   ', es_principal: true }]
      };
      expect(window.getProductImageUrl(product)).toBe('');
    });

    test('getProductImageUrl con image="null" (linea 135 p truthy && p !== null false)', () => {
      require('../../frontend/js/safeImage');
      const product = { image: 'null' };
      expect(window.getProductImageUrl(product)).toBe('');
    });

    test('getProductImageUrl con image whitespace (linea 135 p falsy)', () => {
      require('../../frontend/js/safeImage');
      const product = { image: '   ' };
      expect(window.getProductImageUrl(product)).toBe('');
    });

    test('createSafeImage con alt null (linea 149 true)', () => {
      require('../../frontend/js/safeImage');
      const img = window.createSafeImage('https://example.com/img.jpg', null);
      expect(img.alt).toBe('');
    });

    test('createSafeImage con style (linea 152 true)', () => {
      require('../../frontend/js/safeImage');
      const img = window.createSafeImage('https://example.com/img.jpg', 'Test', { style: 'width:100px' });
      expect(img.getAttribute('style')).toBe('width:100px');
    });

    test('createSafeImage con lazy false (linea 153 true)', () => {
      require('../../frontend/js/safeImage');
      const img = window.createSafeImage('https://example.com/img.jpg', 'Test', { lazy: false });
      expect(img.loading).toBe('eager');
    });
  });

    test('createSafeImage: onerror del img llama a imgError', () => {
      require('../../frontend/js/safeImage');
      const img = window.createSafeImage('https://example.com/broken.jpg', 'Test');
      img.dispatchEvent(new Event('error'));
      expect(img.classList.contains('img-placeholder')).toBe(true);
    });

    test('createSafeImage: onerror con placeholder usa fallback del opts', () => {
      require('../../frontend/js/safeImage');
      const img = window.createSafeImage('https://example.com/broken.jpg', 'Test', { placeholder: '💎' });
      img.dispatchEvent(new Event('error'));
      expect(img.getAttribute('src')).toContain(encodeURIComponent('💎'));
    });

    test('createSafeImage: onerror con placeholder usa fallback del opts', () => {
      require('../../frontend/js/safeImage');
      document.documentElement.setAttribute('data-theme', 'dark');
      const img = window.createSafeImage('https://example.com/broken.jpg', 'Test');
      img.dispatchEvent(new Event('error'));
      expect(img.classList.contains('img-placeholder')).toBe(true);
      document.documentElement.removeAttribute('data-theme');
    });

    describe('window exports', () => {
    test('expone renderProductImage', () => {
      require('../../frontend/js/safeImage');
      expect(typeof window.renderProductImage).toBe('function');
    });

    test('expone createSafeImage', () => {
      require('../../frontend/js/safeImage');
      expect(typeof window.createSafeImage).toBe('function');
    });

    test('expone imgError', () => {
      require('../../frontend/js/safeImage');
      expect(typeof window.imgError).toBe('function');
    });

    test('expone getPlaceholderDataUri', () => {
      require('../../frontend/js/safeImage');
      expect(typeof window.getPlaceholderDataUri).toBe('function');
    });

    test('expone getProductImageUrl', () => {
      require('../../frontend/js/safeImage');
      expect(typeof window.getProductImageUrl).toBe('function');
    });
  });
});
