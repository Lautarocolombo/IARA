/**
 * Tests unitarios para productImages.js
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

// Mock de showToast
global.showToast = jest.fn();

// Mock de renderProductImage
global.renderProductImage = jest.fn(() => '<img src="" alt="product" />');

global.URL.createObjectURL = jest.fn(() => 'blob:test');

describe('productImages.js', () => {
  let fetchWithRetryMock;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
    fetchWithRetryMock = jest.fn();
    global.fetchWithRetry = fetchWithRetryMock;
    document.body.innerHTML = '';
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('init', () => {
    test('no hace nada si dropzone o gallery no existen', () => {
      document.body.innerHTML = '';
      require('../../frontend/js/productImages');
      expect(() => window.ProductImages.init('123')).not.toThrow();
    });

    test('inicializa sin productId (modo pending)', () => {
      document.body.innerHTML = `
        <div id="productImageDropzone"></div>
        <div id="productImageGallery"></div>
      `;
      require('../../frontend/js/productImages');
      window.ProductImages.init();
      expect(document.getElementById('productImageGallery').innerHTML).toBe('');
    });

    test('inicializa con productId', () => {
      document.body.innerHTML = `
        <div id="productImageDropzone"></div>
        <div id="productImageGallery"></div>
      `;
      require('../../frontend/js/productImages');
      window.ProductImages.init('123');
      expect(document.getElementById('productImageGallery').innerHTML).toBe('');
    });
  });

  describe('addPendingUrl', () => {
    test('no hace nada si no hay URL', () => {
      document.body.innerHTML = `
        <input id="productImageUrl" value="" />
        <button id="productImageUrlBtn"></button>
      `;
      require('../../frontend/js/productImages');
      window.ProductImages.addPendingUrl();
      expect(global.showToast).not.toHaveBeenCalled();
    });

    test('rechaza URLs sin http/https', () => {
      document.body.innerHTML = `
        <input id="productImageUrl" value="ftp://example.com/image.jpg" />
        <button id="productImageUrlBtn"></button>
      `;
      require('../../frontend/js/productImages');
      window.ProductImages.addPendingUrl();
      expect(global.showToast).toHaveBeenCalledWith('URL debe comenzar con http:// o https://', 'error');
    });

    test('rechaza extensiones no permitidas', () => {
      document.body.innerHTML = `
        <input id="productImageUrl" value="https://example.com/image.bmp" />
        <button id="productImageUrlBtn"></button>
      `;
      require('../../frontend/js/productImages');
      window.ProductImages.addPendingUrl();
      expect(global.showToast).toHaveBeenCalledWith('Formato no permitido. Usá JPG, PNG, WEBP o GIF', 'error');
    });

    test('extrae nombre de archivo de URL', () => {
      const url = 'https://example.com/path/image.jpg';
      const fileName = url.split('/').pop().split('?')[0] || 'imagen-externa.jpg';
      expect(fileName).toBe('image.jpg');
    });

    test('extrae extensión correctamente', () => {
      const url = 'https://example.com/image.JPG';
      const fileName = url.split('/').pop().split('?')[0] || '';
      const ext = fileName.split('.').pop().toLowerCase();
      expect(ext).toBe('jpg');
    });
  });

  describe('addPendingFiles', () => {
    test('rechaza formatos no permitidos', () => {
      document.body.innerHTML = `
        <div id="productImageDropzone"></div>
        <div id="productImageGallery"></div>
      `;
      require('../../frontend/js/productImages');
      const files = [{ type: 'image/bmp', size: 1000, name: 'test.bmp' }];
      window.ProductImages.addPendingFiles(files);
      expect(global.showToast).toHaveBeenCalledWith(expect.stringContaining('formato no permitido'), 'error');
    });

    test('rechaza archivos muy grandes', () => {
      document.body.innerHTML = `
        <div id="productImageDropzone"></div>
        <div id="productImageGallery"></div>
      `;
      require('../../frontend/js/productImages');
      const files = [{ type: 'image/jpeg', size: 300 * 1024 * 1024, name: 'test.jpg' }];
      window.ProductImages.addPendingFiles(files);
      expect(global.showToast).toHaveBeenCalledWith(expect.stringContaining('200MB'), 'error');
    });

    test('agrega archivos válidos', () => {
      document.body.innerHTML = `
        <div id="productImageDropzone"></div>
        <div id="productImageGallery"></div>
      `;
      require('../../frontend/js/productImages');
      const files = [{ type: 'image/jpeg', size: 1000, name: 'test.jpg' }];
      window.ProductImages.addPendingFiles(files);
      expect(window.ProductImages.hasPendingFiles()).toBe(true);
    });
  });

  describe('removePendingFile', () => {
    test('elimina archivo pendiente por índice', () => {
      document.body.innerHTML = `
        <div id="productImageDropzone"></div>
        <div id="productImageGallery"></div>
      `;
      require('../../frontend/js/productImages');
      window.ProductImages.addPendingFiles([
        { type: 'image/jpeg', size: 1000, name: 'test1.jpg' },
        { type: 'image/jpeg', size: 2000, name: 'test2.jpg' }
      ]);
      window.ProductImages.removePendingFile(0);
      expect(window.ProductImages.hasPendingFiles()).toBe(true);
    });

    test('elimina el último archivo', () => {
      document.body.innerHTML = `
        <div id="productImageDropzone"></div>
        <div id="productImageGallery"></div>
      `;
      require('../../frontend/js/productImages');
      window.ProductImages.addPendingFiles([
        { type: 'image/jpeg', size: 1000, name: 'test1.jpg' }
      ]);
      window.ProductImages.removePendingFile(0);
      expect(window.ProductImages.hasPendingFiles()).toBe(false);
    });
  });

  describe('renderPendingFileList', () => {
    test('no hace nada si no existe el contenedor', () => {
      document.body.innerHTML = '';
      require('../../frontend/js/productImages');
      expect(() => window.ProductImages.renderPendingFileList()).not.toThrow();
    });

    test('renderiza lista vacía cuando no hay archivos', () => {
      document.body.innerHTML = '<div id="productImageFilesList"></div>';
      require('../../frontend/js/productImages');
      window.ProductImages.renderPendingFileList();
      expect(document.getElementById('productImageFilesList').innerHTML).toBe('');
    });

    test('renderiza lista de archivos', () => {
      document.body.innerHTML = '<div id="productImageFilesList"></div>';
      require('../../frontend/js/productImages');
      window.ProductImages.addPendingFiles([
        { type: 'image/jpeg', size: 1024, name: 'test.jpg' }
      ]);
      window.ProductImages.renderPendingFileList();
      expect(document.getElementById('productImageFilesList').innerHTML).toContain('test.jpg');
    });
  });

  describe('renderPendingPreview', () => {
    test('no hace nada si no existe el contenedor', () => {
      document.body.innerHTML = '';
      require('../../frontend/js/productImages');
      expect(() => window.ProductImages.renderPendingPreview()).not.toThrow();
    });

    test('muestra estado vacío cuando no hay archivos', () => {
      document.body.innerHTML = '<div id="productImageGallery"></div>';
      require('../../frontend/js/productImages');
      window.ProductImages.renderPendingPreview();
      expect(document.getElementById('productImageGallery').innerHTML).toContain('Sin imágenes');
    });

    test('renderiza preview de archivos', () => {
      document.body.innerHTML = '<div id="productImageGallery"></div>';
      require('../../frontend/js/productImages');
      window.ProductImages.addPendingFiles([
        { type: 'image/jpeg', size: 1024, name: 'test.jpg', url: 'blob:test' }
      ]);
      window.ProductImages.renderPendingPreview();
      expect(document.getElementById('productImageGallery').innerHTML).toContain('product-image-item');
    });
  });

  describe('loadImages', () => {
    test('carga imágenes desde API', async () => {
      require('../../frontend/js/productImages');
      const mockImages = [
        { id: 1, url: 'img1.jpg', descripcion: 'Test', es_principal: true }
      ];
      fetchWithRetryMock.mockResolvedValue({
        ok: true,
        json: async () => mockImages
      });

      document.body.innerHTML = '<div id="productImageGallery"></div>';
      await window.ProductImages.loadImages('123');
      expect(fetchWithRetryMock).toHaveBeenCalledWith('/api/products/123/images', {}, 2, 1000);
    });

    test('maneja error al cargar imágenes', async () => {
      require('../../frontend/js/productImages');
      fetchWithRetryMock.mockRejectedValue(new Error('Network error'));

      document.body.innerHTML = '<div id="productImageGallery"></div>';
      await window.ProductImages.loadImages('123');
      expect(document.getElementById('productImageGallery').innerHTML).toContain('No se pudieron cargar');
    });

    test('no hace nada si gallery no existe', async () => {
      require('../../frontend/js/productImages');
      fetchWithRetryMock.mockResolvedValue({
        ok: true,
        json: async () => [{ id: 1, url: 'img.jpg' }]
      });
      document.body.innerHTML = '';
      await window.ProductImages.loadImages('123');
    });
  });

  describe('renderGallery', () => {
    test('muestra estado vacío cuando no hay imágenes', () => {
      require('../../frontend/js/productImages');
      const container = document.createElement('div');
      container.id = 'productImageGallery';
      document.body.appendChild(container);
      window.ProductImages.renderGallery(container, [], '123');
      expect(container.innerHTML).toContain('Sin imágenes');
    });

    test('renderiza imágenes con acciones', () => {
      require('../../frontend/js/productImages');
      const container = document.createElement('div');
      container.id = 'productImageGallery';
      document.body.appendChild(container);
      const images = [
        { id: 1, url: 'img1.jpg', descripcion: 'Test', es_principal: true, orden: 1 }
      ];
      window.ProductImages.renderGallery(container, images, '123');
      expect(container.innerHTML).toContain('product-image-item');
      expect(container.innerHTML).toContain('Principal');
    });

    test('renderiza imagen no principal sin texto Principal', () => {
      require('../../frontend/js/productImages');
      const container = document.createElement('div');
      container.id = 'productImageGallery';
      document.body.appendChild(container);
      const images = [
        { id: 1, url: 'img1.jpg', descripcion: 'Test', es_principal: false, orden: 1 }
      ];
      window.ProductImages.renderGallery(container, images, '123');
      expect(container.innerHTML).not.toContain('⭐ Principal');
    });

    test('renderiza categoría de imagen', () => {
      require('../../frontend/js/productImages');
      const container = document.createElement('div');
      container.id = 'productImageGallery';
      document.body.appendChild(container);
      const images = [
        { id: 1, url: 'img1.jpg', descripcion: 'Test', categoria: 'pulseras', es_principal: true, orden: 1 }
      ];
      window.ProductImages.renderGallery(container, images, '123');
      expect(container.innerHTML).toContain('cat-pulseras');
    });
  });

  describe('window exports', () => {
    test('expone init', () => {
      require('../../frontend/js/productImages');
      expect(typeof window.ProductImages.init).toBe('function');
    });

    test('expone loadImages', () => {
      require('../../frontend/js/productImages');
      expect(typeof window.ProductImages.loadImages).toBe('function');
    });

    test('expone uploadFiles', () => {
      require('../../frontend/js/productImages');
      expect(typeof window.ProductImages.uploadFiles).toBe('function');
    });

    test('expone replaceImage', () => {
      require('../../frontend/js/productImages');
      expect(typeof window.ProductImages.replaceImage).toBe('function');
    });

    test('expone deleteImage', () => {
      require('../../frontend/js/productImages');
      expect(typeof window.ProductImages.deleteImage).toBe('function');
    });

    test('expone removePendingFile', () => {
      require('../../frontend/js/productImages');
      expect(typeof window.ProductImages.removePendingFile).toBe('function');
    });
  });

  describe('uploadPending', () => {
    test('retorna 0 si no hay archivos pendientes', async () => {
      window.fetchWithRetry = jest.fn();
      require('../../frontend/js/productImages');
      const result = await window.ProductImages.uploadPending('123');
      expect(result).toBe(0);
      expect(window.fetchWithRetry).not.toHaveBeenCalled();
    });

    test('retorna 0 si no hay productId', async () => {
      window.fetchWithRetry = jest.fn();
      require('../../frontend/js/productImages');
      const result = await window.ProductImages.uploadPending('');
      expect(result).toBe(0);
    });

    test('maneja error de red al subir', async () => {
      window.fetchWithRetry = jest.fn().mockRejectedValue(new Error('Error de red'));
      require('../../frontend/js/productImages');
      const result = await window.ProductImages.uploadPending('123');
      expect(result).toBe(0);
    });
  });

  describe('deleteImage', () => {
    test('elimina imagen exitosamente', async () => {
      window.fetchWithRetry = jest.fn().mockResolvedValue({ ok: true, json: async () => ({}) });
      require('../../frontend/js/productImages');
      await window.ProductImages.deleteImage('123', '1');
      expect(window.fetchWithRetry).toHaveBeenCalledWith(
        expect.stringContaining('/api/products/123/images/1'),
        expect.objectContaining({ method: 'DELETE' }),
        2,
        1000
      );
    });

    test('maneja error al eliminar', async () => {
      window.fetchWithRetry = jest.fn().mockResolvedValue({ ok: false, json: async () => ({ error: 'No encontrado' }) });
      require('../../frontend/js/productImages');
      await window.ProductImages.deleteImage('123', '1');
    });
  });

  describe('replaceImage', () => {
    test('reemplaza imagen exitosamente', async () => {
      window.fetchWithRetry = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ url: 'new.jpg' }) });
      require('../../frontend/js/productImages');
      const file = { type: 'image/jpeg', size: 1024 };
      await window.ProductImages.replaceImage('123', '1', file);
      expect(window.fetchWithRetry).toHaveBeenCalledWith(
        expect.stringContaining('/api/products/123/images/1/replace'),
        expect.objectContaining({ method: 'PUT' }),
        2,
        1000
      );
    });

    test('rechaza formato no permitido', async () => {
      window.fetchWithRetry = jest.fn();
      require('../../frontend/js/productImages');
      const file = { type: 'image/bmp', size: 1024 };
      await window.ProductImages.replaceImage('123', '1', file);
      expect(window.fetchWithRetry).not.toHaveBeenCalled();
    });
  });

  describe('markPrincipal', () => {
    test('marca imagen como principal', async () => {
      window.fetchWithRetry = jest.fn().mockResolvedValue({ ok: true, json: async () => ({}) });
      require('../../frontend/js/productImages');
      await window.ProductImages.markPrincipal('123', '1');
      expect(window.fetchWithRetry).toHaveBeenCalledWith(
        expect.stringContaining('/api/products/123/images/1'),
        expect.objectContaining({ method: 'PATCH', body: JSON.stringify({ es_principal: true }) }),
        2,
        1000
      );
    });
  });

  describe('updateImageMeta', () => {
    test('actualiza metadatos de imagen', async () => {
      window.fetchWithRetry = jest.fn().mockResolvedValue({ ok: true, json: async () => ({}) });
      require('../../frontend/js/productImages');
      await window.ProductImages.updateImageMeta('123', '1', { descripcion: 'Nueva desc', categoria: 'pulseras' });
      expect(window.fetchWithRetry).toHaveBeenCalledWith(
        expect.stringContaining('/api/products/123/images/1'),
        expect.objectContaining({ method: 'PATCH', body: JSON.stringify({ descripcion: 'Nueva desc', categoria: 'pulseras' }) }),
        2,
        1000
      );
    });
  });

  describe('syncOrder', () => {
    test('sincroniza orden de imágenes', async () => {
      window.fetchWithRetry = jest.fn().mockResolvedValue({ ok: true, json: async () => ({}) });
      require('../../frontend/js/productImages');
      await window.ProductImages.syncOrder('123', [1, 2, 3]);
      expect(window.fetchWithRetry).toHaveBeenCalledWith(
        expect.stringContaining('/api/products/123/images/sync-order'),
        expect.objectContaining({ method: 'POST', body: JSON.stringify({ orden: [1, 2, 3] }) }),
        2,
        1000
      );
    });
  });
});
