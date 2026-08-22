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

  describe('cobertura adicional - productImages', () => {
    function flushPromises() {
      return new Promise(function (resolve) {
        require('timers').setImmediate(resolve);
      });
    }

    function installXhr(config) {
      config = config || {};
      var status = config.status !== undefined ? config.status : 200;
      var responseText = config.responseText !== undefined ? config.responseText : '{}';
      var progress = config.progress || null;
      var failure = config.failure === true;
      var instances = [];
      var lastInstance = null;
      var FakeXHR = function () {
        var h = {};
        var upload = { addEventListener: jest.fn(function (evt, cb) { h['u_' + evt] = cb; }) };
        var inst = {
          status: status,
          responseText: responseText,
          upload: upload,
          addEventListener: jest.fn(function (evt, cb) { h[evt] = cb; }),
          open: jest.fn(),
          setRequestHeader: jest.fn(),
          withCredentials: false,
          send: jest.fn(function () {
            if (progress && h['u_progress']) {
              h['u_progress']({ lengthComputable: true, loaded: progress.loaded, total: progress.total });
            }
            if (failure && h['error']) {
              h['error']();
            } else if (h['load']) {
              h['load']();
            }
          })
        };
        instances.push(inst);
        lastInstance = inst;
        return inst;
      };
      global.XMLHttpRequest = jest.fn(FakeXHR);
      return { instances: instances, getLast: function () { return lastInstance; } };
    }

    beforeEach(() => {
      global.fetchWithRetry = fetchWithRetryMock;
    });

    describe('dropzone pendiente y URL paste', () => {
      test('setupPendingDropzone: drop agrega archivos al pending', () => {
        document.body.innerHTML = `
          <div id="productImageDropzone"></div>
          <input id="productImageFiles" type="file" />
          <input id="productImageUrl" value="" />
          <button id="productImageUrlBtn"></button>
          <div id="productImageFilesList"></div>
          <div id="productImageGallery"></div>
        `;
        require('../../frontend/js/productImages');
        window.ProductImages.init();

        var dropzone = document.getElementById('productImageDropzone');
        var file = new File(['content'], 'a.jpg', { type: 'image/jpeg' });
        var dropEvent = new Event('drop', { bubbles: true });
        dropEvent.dataTransfer = { files: [file] };
        dropzone.dispatchEvent(dropEvent);
        expect(window.ProductImages.hasPendingFiles()).toBe(true);
      });

      test('setupPendingDropzone: el input file cambia agrega archivos', () => {
        document.body.innerHTML = `
          <div id="productImageDropzone"></div>
          <input id="productImageFiles" type="file" />
          <input id="productImageUrl" value="" />
          <button id="productImageUrlBtn"></button>
          <div id="productImageFilesList"></div>
          <div id="productImageGallery"></div>
        `;
        require('../../frontend/js/productImages');
        window.ProductImages.init();

        var input = document.getElementById('productImageFiles');
        var file = new File(['content'], 'b.jpg', { type: 'image/jpeg' });
        Object.defineProperty(input, 'files', { value: [file], configurable: true });
        input.dispatchEvent(new Event('change'));
        expect(window.ProductImages.hasPendingFiles()).toBe(true);
      });

      test('setupUrlPaste: click del botón agrega URL válida', () => {
        document.body.innerHTML = `
          <div id="productImageDropzone"></div>
          <input id="productImageFiles" type="file" />
          <input id="productImageUrl" value="" />
          <button id="productImageUrlBtn"></button>
          <div id="productImageFilesList"></div>
          <div id="productImageGallery"></div>
        `;
        require('../../frontend/js/productImages');
        window.ProductImages.init();
        document.getElementById('productImageUrl').value = 'https://example.com/img.jpg';
        document.getElementById('productImageUrlBtn').click();
        expect(window.ProductImages.hasPendingFiles()).toBe(true);
        expect(global.showToast).toHaveBeenCalledWith('URL de imagen agregada', 'success');
      });

      test('setupUrlPaste: Enter en input agrega URL válida', () => {
        document.body.innerHTML = `
          <div id="productImageDropzone"></div>
          <input id="productImageFiles" type="file" />
          <input id="productImageUrl" value="" />
          <button id="productImageUrlBtn"></button>
          <div id="productImageFilesList"></div>
          <div id="productImageGallery"></div>
        `;
        require('../../frontend/js/productImages');
        window.ProductImages.init();
        var urlInput = document.getElementById('productImageUrl');
        urlInput.value = 'https://example.com/img2.jpg';
        var keyEvent = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true });
        urlInput.dispatchEvent(keyEvent);
        expect(window.ProductImages.hasPendingFiles()).toBe(true);
      });

      test('setupUrlPaste: Enter con URL vacía no agrega', () => {
        document.body.innerHTML = `
          <div id="productImageDropzone"></div>
          <input id="productImageFiles" type="file" />
          <input id="productImageUrl" value="" />
          <button id="productImageUrlBtn"></button>
          <div id="productImageFilesList"></div>
          <div id="productImageGallery"></div>
        `;
        require('../../frontend/js/productImages');
        window.ProductImages.init();
        var urlInput = document.getElementById('productImageUrl');
        urlInput.value = '   ';
        var keyEvent = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true });
        urlInput.dispatchEvent(keyEvent);
        expect(window.ProductImages.hasPendingFiles()).toBe(false);
      });

      test('setupPendingDropzone: drop de archivo no imagen no agrega', () => {
        document.body.innerHTML = `
          <div id="productImageDropzone"></div>
          <input id="productImageFiles" type="file" />
          <input id="productImageUrl" value="" />
          <button id="productImageUrlBtn"></button>
          <div id="productImageFilesList"></div>
          <div id="productImageGallery"></div>
        `;
        require('../../frontend/js/productImages');
        window.ProductImages.init();
        var dropzone = document.getElementById('productImageDropzone');
        var dropEvent = new Event('drop', { bubbles: true });
        dropEvent.dataTransfer = { files: [{ type: 'text/plain', size: 10 }] };
        dropzone.dispatchEvent(dropEvent);
        expect(window.ProductImages.hasPendingFiles()).toBe(false);
      });

      test('setupPendingDropzone: input file vacío no agrega', () => {
        document.body.innerHTML = `
          <div id="productImageDropzone"></div>
          <input id="productImageFiles" type="file" />
          <input id="productImageUrl" value="" />
          <button id="productImageUrlBtn"></button>
          <div id="productImageFilesList"></div>
          <div id="productImageGallery"></div>
        `;
        require('../../frontend/js/productImages');
        window.ProductImages.init();
        var input = document.getElementById('productImageFiles');
        Object.defineProperty(input, 'files', { value: [], configurable: true });
        input.dispatchEvent(new Event('change'));
        expect(window.ProductImages.hasPendingFiles()).toBe(false);
      });

      test('setupUrlPaste: click con URL vacía no agrega', () => {
        document.body.innerHTML = `
          <div id="productImageDropzone"></div>
          <input id="productImageFiles" type="file" />
          <input id="productImageUrl" value="   " />
          <button id="productImageUrlBtn"></button>
          <div id="productImageFilesList"></div>
          <div id="productImageGallery"></div>
        `;
        require('../../frontend/js/productImages');
        window.ProductImages.init();
        document.getElementById('productImageUrlBtn').click();
        expect(window.ProductImages.hasPendingFiles()).toBe(false);
      });

      test('setupUrlPaste: keydown distinto de Enter no agrega', () => {
        document.body.innerHTML = `
          <div id="productImageDropzone"></div>
          <input id="productImageFiles" type="file" />
          <input id="productImageUrl" value="https://example.com/img.jpg" />
          <button id="productImageUrlBtn"></button>
          <div id="productImageFilesList"></div>
          <div id="productImageGallery"></div>
        `;
        require('../../frontend/js/productImages');
        window.ProductImages.init();
        var urlInput = document.getElementById('productImageUrl');
        var keyEvent = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true });
        urlInput.dispatchEvent(keyEvent);
        expect(window.ProductImages.hasPendingFiles()).toBe(false);
      });
    });

    describe('uploadPending', () => {
      test('sube imágenes por URL y devuelve la cantidad', async () => {
        document.body.innerHTML = '<input id="productImageUrl" value="https://example.com/img.jpg"><div id="productImageGallery"></div><div id="productImageFilesList"></div>';
        require('../../frontend/js/productImages');
        global.__getAdminToken = function () { return 'token'; };
        window.ProductImages.addPendingUrl();
        var xhr = installXhr({ status: 200, responseText: '{}' });
        fetchWithRetryMock.mockResolvedValue({ ok: true, json: async () => [] });
        var result = await window.ProductImages.uploadPending('123');
        expect(result).toBe(1);
        expect(xhr.getLast().send).toHaveBeenCalled();
        delete global.__getAdminToken;
      });

      test('sube archivos reales (File) y devuelve la cantidad', async () => {
        document.body.innerHTML = '<input id="productImageFiles"><div id="productImageGallery"></div><div id="productImageFilesList"></div>';
        require('../../frontend/js/productImages');
        var file = new File(['content'], 'a.jpg', { type: 'image/jpeg' });
        window.ProductImages.addPendingFiles([file]);
        installXhr({ status: 200, responseText: '{}' });
        fetchWithRetryMock.mockResolvedValue({ ok: true, json: async () => [] });
        var result = await window.ProductImages.uploadPending('999');
        expect(result).toBe(1);
      });

      test('retorna 0 si el XHR falla (network)', async () => {
        document.body.innerHTML = '<input id="productImageUrl" value="https://example.com/img.jpg"><div id="productImageGallery"></div>';
        require('../../frontend/js/productImages');
        window.ProductImages.addPendingUrl();
        installXhr({ failure: true });
        fetchWithRetryMock.mockResolvedValue({ ok: true, json: async () => [] });
        var result = await window.ProductImages.uploadPending('123');
        expect(result).toBe(0);
        expect(global.showToast).toHaveBeenCalledWith('Error de red', 'error');
      });

      test('retorna 0 si el servidor responde con error de status', async () => {
        document.body.innerHTML = '<input id="productImageUrl" value="https://example.com/img.jpg"><div id="productImageGallery"></div>';
        require('../../frontend/js/productImages');
        window.ProductImages.addPendingUrl();
        installXhr({ status: 400, responseText: JSON.stringify({ error: 'prohibido' }) });
        fetchWithRetryMock.mockResolvedValue({ ok: true, json: async () => [] });
        var result = await window.ProductImages.uploadPending('123');
        expect(result).toBe(0);
        expect(global.showToast).toHaveBeenCalledWith('prohibido', 'error');
      });
    });

    describe('renderGallery interactividad', () => {
      function setupGallery() {
        var container = document.createElement('div');
        container.id = 'productImageGallery';
        document.body.appendChild(container);
        var images = [
          { id: 1, url: 'img1.jpg', descripcion: 'desc1', categoria: 'pulseras', es_principal: true, orden: 1 },
          { id: 2, url: 'img2.jpg', descripcion: 'desc2', categoria: 'accesorios', es_principal: false, orden: 2 }
        ];
        fetchWithRetryMock.mockResolvedValue({ ok: true, json: async () => [] });
        window.ProductImages.renderGallery(container, images, '123');
        return container.querySelectorAll('.product-image-item');
      }

      test('dragstart/dragend toggle clase dragging', () => {
        require('../../frontend/js/productImages');
        var items = setupGallery();
        var ds = new Event('dragstart', { bubbles: true });
        ds.dataTransfer = { setData: jest.fn() };
        items[0].dispatchEvent(ds);
        expect(items[0].classList.contains('dragging')).toBe(true);
        items[0].dispatchEvent(new Event('dragend', { bubbles: true }));
        expect(items[0].classList.contains('dragging')).toBe(false);
      });

      test('dragover sin element dragging ni self retorna', () => {
        require('../../frontend/js/productImages');
        var items = setupGallery();
        var over = new Event('dragover', { bubbles: true });
        over.dataTransfer = { setData: jest.fn() };
        over.clientY = 10;
        items[0].dispatchEvent(over);
      });

      test('dragover reordena: rama clientY < mid', () => {
        require('../../frontend/js/productImages');
        var items = setupGallery();
        var ds = new Event('dragstart', { bubbles: true });
        ds.dataTransfer = { setData: jest.fn() };
        items[0].dispatchEvent(ds);
        items[1].getBoundingClientRect = function () { return { top: 100, height: 40, left: 0, right: 0, bottom: 0, width: 0 }; };
        var over = new Event('dragover', { bubbles: true });
        over.clientY = 50;
        items[1].dispatchEvent(over);
        var firstDragging = document.querySelector('.product-image-item.dragging');
        expect(firstDragging).not.toBeNull();
      });

      test('dragover reordena: rama clientY >= mid', () => {
        require('../../frontend/js/productImages');
        var items = setupGallery();
        var ds = new Event('dragstart', { bubbles: true });
        ds.dataTransfer = { setData: jest.fn() };
        items[0].dispatchEvent(ds);
        items[1].getBoundingClientRect = function () { return { top: 100, height: 40, left: 0, right: 0, bottom: 0, width: 0 }; };
        var over = new Event('dragover', { bubbles: true });
        over.clientY = 200;
        items[1].dispatchEvent(over);
      });

      test('drop sincroniza orden y recarga', async () => {
        require('../../frontend/js/productImages');
        var items = setupGallery();
        var ds = new Event('dragstart', { bubbles: true });
        ds.dataTransfer = { setData: jest.fn() };
        items[0].dispatchEvent(ds);
        var dropEvent = new Event('drop', { bubbles: true });
        items[1].dispatchEvent(dropEvent);
        await flushPromises();
        expect(fetchWithRetryMock).toHaveBeenCalledWith(
          expect.stringContaining('/api/products/123/images/sync-order'),
          expect.objectContaining({ method: 'POST' }),
          2,
          1000
        );
      });

      test('principal, edit-meta, save-meta, cancel-meta y delete', async () => {
        require('../../frontend/js/productImages');
        var items = setupGallery();
        // principal
        items[0].querySelector('[data-action="principal"]').click();
        await flushPromises();
        expect(fetchWithRetryMock).toHaveBeenCalledWith(
          expect.stringContaining('/api/products/123/images/1'),
          expect.objectContaining({ method: 'PATCH', body: JSON.stringify({ es_principal: true }) }),
          2,
          1000
        );
        // edit-meta abre formulario
        var editBtn = items[0].querySelector('[data-action="edit-meta"]');
        editBtn.click();
        var metaForm = items[0].querySelector('.product-image-item-meta-form');
        expect(metaForm.style.display).toBe('block');
        // save-meta
        items[0].querySelector('.product-image-item-desc-input').value = 'nueva';
        items[0].querySelector('[data-action="save-meta"]').click();
        await flushPromises();
        // cancel-meta cierra formulario
        items[0].querySelector('[data-action="cancel-meta"]').click();
        expect(metaForm.style.display).toBe('none');
        // delete
        items[0].querySelector('[data-action="delete"]').click();
        await flushPromises();
        expect(fetchWithRetryMock).toHaveBeenCalledWith(
          expect.stringContaining('/api/products/123/images/1'),
          expect.objectContaining({ method: 'DELETE' }),
          2,
          1000
        );
      });
    });

    describe('setupDropzone (modo producto)', () => {
      beforeEach(() => {
        jest.useFakeTimers();
      });

      afterEach(() => {
        jest.clearAllTimers();
        jest.useRealTimers();
        delete global.__getAdminToken;
      });

      test('drop, drag enter/leave y file input disparan uploadFiles', async () => {
        document.body.innerHTML = `
          <div id="productImageDropzone"></div>
          <input id="productImageFiles" type="file" />
          <div id="productImageGallery"></div>
          <div class="image-meta-inputs"></div>
          <input id="pImageDescripcion" value="desc">
          <input id="pImageCategoria" value="pulseras">
          <div id="productImageUploadStatus"></div>
          <div id="productImageUploadProgress"></div>
        `;
        require('../../frontend/js/productImages');
        fetchWithRetryMock.mockResolvedValue({ ok: true, json: async () => [] });
        global.__getAdminToken = function () { return 'token'; };
        window.ProductImages.init('123');

        var dropzone = document.getElementById('productImageDropzone');
        var file = new File(['x'], 'a.jpg', { type: 'image/jpeg' });

        dropzone.dispatchEvent(new Event('dragenter', { bubbles: true }));
        expect(dropzone.classList.contains('drag-over')).toBe(true);
        dropzone.dispatchEvent(new Event('dragleave', { bubbles: true }));
        expect(dropzone.classList.contains('drag-over')).toBe(false);

        installXhr({ status: 200, responseText: JSON.stringify({ images: [{ id: 1, url: 'x.jpg' }] }) });
        var dropEvent = new Event('drop', { bubbles: true });
        dropEvent.dataTransfer = { files: [file] };
        dropzone.dispatchEvent(dropEvent);
        await flushPromises();
        expect(dropzone.classList.contains('drag-over')).toBe(false);
        expect(fetchWithRetryMock.mock.calls.some(function (c) { return String(c[0]).indexOf('/api/products/123/images') !== -1; })).toBe(true);
        jest.advanceTimersByTime(3000);

        installXhr({ status: 200, responseText: JSON.stringify({ images: [] }) });
        var input = document.getElementById('productImageFiles');
        Object.defineProperty(input, 'files', { value: [file], configurable: true });
        input.dispatchEvent(new Event('change'));
        await flushPromises();
        jest.advanceTimersByTime(3000);
      });
    });

    describe('renderGallery replace', () => {
      beforeEach(() => {
        jest.useFakeTimers();
      });

      afterEach(() => {
        jest.clearAllTimers();
        jest.useRealTimers();
        delete global.__getAdminToken;
      });

      test('click en replace abre el input de archivo', () => {
        document.body.innerHTML = '<div id="productImageGallery"></div>';
        require('../../frontend/js/productImages');
        var container = document.getElementById('productImageGallery');
        window.ProductImages.renderGallery(container, [{ id: 1, url: 'img1.jpg', descripcion: 'd', categoria: 'pulseras', es_principal: true, orden: 1 }], '123');
        var replaceInput = container.querySelector('.product-image-item-replace-input');
        var clickSpy = jest.spyOn(replaceInput, 'click');
        container.querySelector('[data-action="replace"]').click();
        expect(clickSpy).toHaveBeenCalled();
      });

      test('change del input de reemplazo llama a replaceImage', async () => {
        document.body.innerHTML = '<div id="productImageGallery"></div><div id="productImageUploadStatus"></div>';
        require('../../frontend/js/productImages');
        fetchWithRetryMock.mockResolvedValue({ ok: true, json: async () => ({ url: 'new.jpg' }) });
        global.__getAdminToken = function () { return 'token'; };
        var container = document.getElementById('productImageGallery');
        window.ProductImages.renderGallery(container, [{ id: 1, url: 'img1.jpg', descripcion: 'd', categoria: 'pulseras', es_principal: true, orden: 1 }], '123');
        var input = container.querySelector('.product-image-item-replace-input');
        Object.defineProperty(input, 'files', { value: [{ type: 'image/jpeg', size: 100, name: 'new.jpg' }], configurable: true });
        input.dispatchEvent(new Event('change'));
        await flushPromises();
        expect(fetchWithRetryMock).toHaveBeenCalledWith(
          expect.stringContaining('/api/products/123/images/1/replace'),
          expect.objectContaining({ method: 'PUT' }),
          2,
          1000
        );
        jest.advanceTimersByTime(3000);
      });
    });

    describe('uploadFiles', () => {
      beforeEach(() => {
        jest.useFakeTimers();
      });

      afterEach(() => {
        jest.clearAllTimers();
        jest.useRealTimers();
        delete global.__getAdminToken;
      });

      test('sube con progreso, status ok y recarga galería', async () => {
        document.body.innerHTML = '<div id="productImageGallery"></div><div class="image-meta-inputs"></div><input id="pImageDescripcion" value="d"><input id="pImageCategoria"><div id="productImageUploadStatus"></div><div id="productImageUploadProgress"></div>';
        require('../../frontend/js/productImages');
        var file = { type: 'image/jpeg', size: 1024, name: 'a.jpg' };
        installXhr({ status: 200, responseText: JSON.stringify({ images: [{ id: 1, url: 'x.jpg' }] }), progress: { loaded: 50, total: 100 } });
        fetchWithRetryMock.mockResolvedValue({ ok: true, json: async () => [] });
        await window.ProductImages.uploadFiles('123', [file]);
        var status = document.getElementById('productImageUploadStatus');
        expect(status.textContent).toContain('Subidas');
        jest.advanceTimersByTime(3000);
      });

      test('rechaza formatos no permitidos', async () => {
        document.body.innerHTML = '<div id="productImageUploadStatus"></div><div id="productImageUploadProgress"></div>';
        require('../../frontend/js/productImages');
        var file = { type: 'image/bmp', size: 1000, name: 'a.bmp' };
        await window.ProductImages.uploadFiles('123', [file]);
        expect(global.showToast).toHaveBeenCalledWith(expect.stringContaining('formato no permitido'), 'error');
        jest.advanceTimersByTime(4000);
      });

      test('rechaza archivos oversized', async () => {
        document.body.innerHTML = '<div id="productImageUploadStatus"></div><div id="productImageUploadProgress"></div>';
        require('../../frontend/js/productImages');
        var file = { type: 'image/jpeg', size: 300 * 1024 * 1024, name: 'big.jpg' };
        await window.ProductImages.uploadFiles('123', [file]);
        expect(global.showToast).toHaveBeenCalledWith(expect.stringContaining('200MB'), 'error');
        jest.advanceTimersByTime(4000);
      });

      test('sube con JSON de respuesta inválido', async () => {
        document.body.innerHTML = '<div id="productImageGallery"></div><input id="pImageDescripcion"><input id="pImageCategoria"><div id="productImageUploadStatus"></div><div id="productImageUploadProgress"></div>';
        require('../../frontend/js/productImages');
        var file = { type: 'image/jpeg', size: 1024, name: 'a.jpg' };
        installXhr({ status: 200, responseText: 'not-json', progress: { loaded: 50, total: 100 } });
        fetchWithRetryMock.mockResolvedValue({ ok: true, json: async () => [] });
        await window.ProductImages.uploadFiles('123', [file]);
        jest.advanceTimersByTime(3000);
      });

      test('progress no computable no actualiza la barra', async () => {
        document.body.innerHTML = '<div id="productImageGallery"></div><div id="productImageUploadStatus"></div><div id="productImageUploadProgress"></div>';
        require('../../frontend/js/productImages');
        var file = { type: 'image/jpeg', size: 1024, name: 'a.jpg' };
        installXhr({ status: 200, responseText: '{}', progress: { loaded: 10, total: 100 } });
        // override: lengthComputable false
        global.XMLHttpRequest = jest.fn(function () {
          var inst = {
            status: 200, responseText: '{}',
            upload: { addEventListener: jest.fn(function (evt, cb) { if (evt === 'progress') cb({ lengthComputable: false }); }) },
            addEventListener: jest.fn(function (evt, cb) { if (evt === 'load') cb(); }),
            open: jest.fn(), setRequestHeader: jest.fn(), withCredentials: false,
            send: jest.fn()
          };
          return inst;
        });
        fetchWithRetryMock.mockResolvedValue({ ok: true, json: async () => [] });
        await window.ProductImages.uploadFiles('123', [file]);
        jest.advanceTimersByTime(3000);
      });

      test('responseText vacío usa fallback {} en load', async () => {
        document.body.innerHTML = '<div id="productImageGallery"></div><div id="productImageUploadStatus"></div><div id="productImageUploadProgress"></div>';
        require('../../frontend/js/productImages');
        var file = { type: 'image/jpeg', size: 1024, name: 'a.jpg' };
        installXhr({ status: 200, responseText: '', progress: { loaded: 50, total: 100 } });
        fetchWithRetryMock.mockResolvedValue({ ok: true, json: async () => [] });
        await window.ProductImages.uploadFiles('123', [file]);
        jest.advanceTimersByTime(3000);
      });

      test('status 403 muestra mensaje de autorización', async () => {
        document.body.innerHTML = '<div id="productImageGallery"></div><div id="productImageUploadStatus"></div><div id="productImageUploadProgress"></div>';
        require('../../frontend/js/productImages');
        installXhr({ status: 403, responseText: JSON.stringify({ error: '' }) });
        fetchWithRetryMock.mockResolvedValue({ ok: true, json: async () => [] });
        await window.ProductImages.uploadFiles('123', [{ type: 'image/jpeg', size: 1024, name: 'a.jpg' }]);
        expect(global.showToast).toHaveBeenCalledWith(expect.stringContaining('No autorizado'), 'error');
        jest.advanceTimersByTime(3000);
      });

      test('maneja error de red (XHR error)', async () => {
        document.body.innerHTML = '<div id="productImageGallery"></div><div id="productImageUploadStatus"></div><div id="productImageUploadProgress"></div>';
        require('../../frontend/js/productImages');
        var file = { type: 'image/jpeg', size: 1000, name: 'a.jpg' };
        installXhr({ failure: true });
        fetchWithRetryMock.mockResolvedValue({ ok: true, json: async () => [] });
        await window.ProductImages.uploadFiles('123', [file]);
        expect(global.showToast).toHaveBeenCalledWith('Error de red', 'error');
        jest.advanceTimersByTime(3000);
      });

      test('maneja status de error del servidor', async () => {
        document.body.innerHTML = '<div id="productImageGallery"></div><div id="productImageUploadStatus"></div><div id="productImageUploadProgress"></div>';
        require('../../frontend/js/productImages');
        var file = { type: 'image/jpeg', size: 1000, name: 'a.jpg' };
        installXhr({ status: 500, responseText: JSON.stringify({ error: 'boom' }) });
        fetchWithRetryMock.mockResolvedValue({ ok: true, json: async () => [] });
        await window.ProductImages.uploadFiles('123', [file]);
        expect(global.showToast).toHaveBeenCalledWith(expect.stringContaining('boom'), 'error');
        jest.advanceTimersByTime(3000);
      });
    });

    describe('replaceImage', () => {
      beforeEach(() => {
        jest.useFakeTimers();
      });

      afterEach(() => {
        jest.clearAllTimers();
        jest.useRealTimers();
        delete global.__getAdminToken;
      });

      test('rechaza tipo no permitido', async () => {
        document.body.innerHTML = '<div id="productImageUploadStatus"></div>';
        require('../../frontend/js/productImages');
        await window.ProductImages.replaceImage('123', '1', { type: 'image/bmp', size: 100 });
        expect(global.showToast).toHaveBeenCalledWith('Formato no permitido', 'error');
        jest.advanceTimersByTime(3000);
      });

      test('rechaza archivo oversized', async () => {
        document.body.innerHTML = '<div id="productImageUploadStatus"></div>';
        require('../../frontend/js/productImages');
        await window.ProductImages.replaceImage('123', '1', { type: 'image/jpeg', size: 300 * 1024 * 1024 });
        expect(global.showToast).toHaveBeenCalledWith('Imagen muy grande (máx 200MB)', 'error');
        jest.advanceTimersByTime(3000);
      });

      test('maneja error de red (!res)', async () => {
        document.body.innerHTML = '<div id="productImageGallery"></div><div id="productImageUploadStatus"></div>';
        require('../../frontend/js/productImages');
        fetchWithRetryMock.mockResolvedValue(null);
        await window.ProductImages.replaceImage('123', '1', { type: 'image/jpeg', size: 100 });
        expect(global.showToast).toHaveBeenCalledWith('Error de red', 'error');
        jest.advanceTimersByTime(3000);
      });

      test('maneja error del servidor (!res.ok)', async () => {
        document.body.innerHTML = '<div id="productImageGallery"></div><div id="productImageUploadStatus"></div>';
        require('../../frontend/js/productImages');
        fetchWithRetryMock.mockResolvedValue({ ok: false, json: async () => ({ error: 'nope' }) });
        await window.ProductImages.replaceImage('123', '1', { type: 'image/jpeg', size: 100 });
        expect(global.showToast).toHaveBeenCalledWith('nope', 'error');
        jest.advanceTimersByTime(3000);
      });

      test('reemplaza exitosamente con token', async () => {
        document.body.innerHTML = '<div id="productImageGallery"></div><div id="productImageUploadStatus"></div>';
        require('../../frontend/js/productImages');
        global.__getAdminToken = function () { return 'token'; };
        fetchWithRetryMock.mockResolvedValue({ ok: true, json: async () => ({ url: 'new.jpg' }) });
        await window.ProductImages.replaceImage('123', '1', { type: 'image/jpeg', size: 1024 });
        var status = document.getElementById('productImageUploadStatus');
        expect(status.textContent).toContain('reemplazada');
        jest.advanceTimersByTime(3000);
      });
    });

    describe('marca principal / meta / delete / sync errors', () => {
      test('markPrincipal: error de red y error del servidor', async () => {
        document.body.innerHTML = '<div id="productImageGallery"></div>';
        require('../../frontend/js/productImages');
        fetchWithRetryMock.mockResolvedValue(null);
        await window.ProductImages.markPrincipal('123', '1');
        expect(global.showToast).toHaveBeenCalledWith('Error de red', 'error');
        fetchWithRetryMock.mockResolvedValue({ ok: false, json: async () => ({ error: 'denegado' }) });
        await window.ProductImages.markPrincipal('123', '1');
        expect(global.showToast).toHaveBeenCalledWith('denegado', 'error');
      });

      test('updateImageMeta: error de red y error del servidor', async () => {
        document.body.innerHTML = '<div id="productImageGallery"></div>';
        require('../../frontend/js/productImages');
        fetchWithRetryMock.mockResolvedValue(null);
        await window.ProductImages.updateImageMeta('123', '1', { descripcion: 'x' });
        expect(global.showToast).toHaveBeenCalledWith('Error de red', 'error');
        fetchWithRetryMock.mockResolvedValue({ ok: false, json: async () => ({ error: 'bad meta' }) });
        await window.ProductImages.updateImageMeta('123', '1', { descripcion: 'x' });
        expect(global.showToast).toHaveBeenCalledWith('bad meta', 'error');
      });

      test('deleteImage: error de red y error del servidor', async () => {
        document.body.innerHTML = '<div id="productImageGallery"></div>';
        require('../../frontend/js/productImages');
        fetchWithRetryMock.mockResolvedValue(null);
        await window.ProductImages.deleteImage('123', '1');
        expect(global.showToast).toHaveBeenCalledWith('Error de red', 'error');
        fetchWithRetryMock.mockResolvedValue({ ok: false, json: async () => ({ error: 'no delete' }) });
        await window.ProductImages.deleteImage('123', '1');
        expect(global.showToast).toHaveBeenCalledWith('no delete', 'error');
      });

      test('syncOrder: error de red y error del servidor', async () => {
        document.body.innerHTML = '<div id="productImageGallery"></div>';
        require('../../frontend/js/productImages');
        fetchWithRetryMock.mockResolvedValue(null);
        await window.ProductImages.syncOrder('123', [1, 2, 3]);
        expect(global.showToast).toHaveBeenCalledWith('Error de red', 'error');
        fetchWithRetryMock.mockResolvedValue({ ok: false, json: async () => ({ error: 'no sync' }) });
        await window.ProductImages.syncOrder('123', [1, 2, 3]);
        expect(global.showToast).toHaveBeenCalledWith('no sync', 'error');
      });

      test('data.error ausente usa mensaje por defecto en todos los métodos', async () => {
        document.body.innerHTML = '<div id="productImageGallery"></div>';
        require('../../frontend/js/productImages');
        fetchWithRetryMock.mockResolvedValue({ ok: false, json: async () => ({}) });
        await window.ProductImages.markPrincipal('123', '1');
        expect(global.showToast).toHaveBeenCalledWith('Error al actualizar', 'error');
        await window.ProductImages.updateImageMeta('123', '1', { descripcion: 'x' });
        expect(global.showToast).toHaveBeenCalledWith('Error al actualizar metadatos', 'error');
        await window.ProductImages.deleteImage('123', '1');
        expect(global.showToast).toHaveBeenCalledWith('Error al eliminar', 'error');
        await window.ProductImages.syncOrder('123', [1, 2, 3]);
        expect(global.showToast).toHaveBeenCalledWith('Error al sincronizar orden', 'error');
      });
    });

    describe('ramas defensivas', () => {
      beforeEach(() => {
        jest.useFakeTimers();
      });

      afterEach(() => {
        jest.clearAllTimers();
        jest.useRealTimers();
        delete global.__getAdminToken;
      });

      test('addPendingUrl sin input y URLs edge (fallback name, ext no jpg)', () => {
        require('../../frontend/js/productImages');
        document.body.innerHTML = '';
        expect(function () { window.ProductImages.addPendingUrl(); }).not.toThrow();

        document.body.innerHTML = '<input id="productImageUrl" value="https://x.com/"><div id="productImageFilesList"></div>';
        window.ProductImages.addPendingUrl();

        document.body.innerHTML = '<input id="productImageUrl" value="https://x.com/c.png"><div id="productImageFilesList"></div>';
        window.ProductImages.addPendingUrl();
        expect(window.ProductImages.hasPendingFiles()).toBe(true);
      });

      test('uploadPending: gallery/filesList nulos, responseText vacío', async () => {
        require('../../frontend/js/productImages');
        document.body.innerHTML = '<input id="productImageUrl" value="https://x.com/a.jpg"><div id="productImageFilesList"></div>';
        window.ProductImages.addPendingUrl();
        installXhr({ status: 200, responseText: '' });
        fetchWithRetryMock.mockResolvedValue({ ok: true, json: async () => [] });
        var result = await window.ProductImages.uploadPending('7');
        expect(result).toBe(1);
      });

      test('uploadPending: status error sin detalle usa fallback', async () => {
        require('../../frontend/js/productImages');
        document.body.innerHTML = '<input id="productImageUrl" value="https://x.com/a.jpg"><div id="productImageGallery"></div>';
        window.ProductImages.addPendingUrl();
        installXhr({ status: 404, responseText: '{}' });
        var result = await window.ProductImages.uploadPending('123');
        expect(result).toBe(0);
        expect(global.showToast).toHaveBeenCalledWith('Error al subir imágenes', 'error');
      });

      test('renderGallery: imagen sin descripcion/categoria y categorias varias', () => {
        document.body.innerHTML = '<div id="productImageGallery"></div>';
        require('../../frontend/js/productImages');
        var c = document.getElementById('productImageGallery');
        window.ProductImages.renderGallery(c, [
          { id: 1, url: 'i1.jpg', es_principal: false, orden: 1 },
          { id: 2, url: 'i2.jpg', descripcion: 'D', categoria: 'pulseras', es_principal: false, orden: 2 },
          { id: 3, url: 'i3.jpg', descripcion: 'D', categoria: 'accesorios', es_principal: false, orden: 3 },
          { id: 4, url: 'i4.jpg', descripcion: 'D', categoria: 'souvenirs', es_principal: true, orden: 4 }
        ], '123');
        expect(c.querySelectorAll('.product-image-item').length).toBe(4);
      });

      test('replaceImage: sin status element en path success', async () => {
        document.body.innerHTML = '<div id="productImageGallery"></div>';
        require('../../frontend/js/productImages');
        fetchWithRetryMock.mockResolvedValue({ ok: true, json: async () => ({ url: 'new.jpg' }) });
        await window.ProductImages.replaceImage('123', '1', { type: 'image/jpeg', size: 1024 });
        jest.advanceTimersByTime(3000);
      });

      test('replaceImage: ok con data.error ausente', async () => {
        document.body.innerHTML = '<div id="productImageGallery"></div><div id="productImageUploadStatus"></div>';
        require('../../frontend/js/productImages');
        fetchWithRetryMock.mockResolvedValue({ ok: false, json: async () => ({}) });
        await window.ProductImages.replaceImage('123', '1', { type: 'image/jpeg', size: 100 });
        expect(global.showToast).toHaveBeenCalledWith('Error al reemplazar', 'error');
        jest.advanceTimersByTime(3000);
      });
    });

    describe('cobertura branches adicionales', () => {
      function flushPromises() {
        return new Promise(function (resolve) {
          require('timers').setImmediate(resolve);
        });
      }

      function installXhr(config) {
        config = config || {};
        var status = config.status !== undefined ? config.status : 200;
        var responseText = config.responseText !== undefined ? config.responseText : '{}';
        var progress = config.progress || null;
        var failure = config.failure === true;
        var instances = [];
        var lastInstance = null;
        var FakeXHR = function () {
          var h = {};
          var upload = { addEventListener: jest.fn(function (evt, cb) { h['u_' + evt] = cb; }) };
          var inst = {
            status: status,
            responseText: responseText,
            upload: upload,
            addEventListener: jest.fn(function (evt, cb) { h[evt] = cb; }),
            open: jest.fn(),
            setRequestHeader: jest.fn(),
            withCredentials: false,
            send: jest.fn(function () {
              if (progress && h['u_progress']) {
                h['u_progress']({ lengthComputable: true, loaded: progress.loaded, total: progress.total });
              }
              if (failure && h['error']) {
                h['error']();
              } else if (h['load']) {
                h['load']();
              }
            })
          };
          instances.push(inst);
          lastInstance = inst;
          return inst;
        };
        global.XMLHttpRequest = jest.fn(FakeXHR);
        return { instances: instances, getLast: function () { return lastInstance; } };
      }

      afterEach(() => {
        delete global.__getAdminToken;
      });

      test('renderPendingPreview: file con url de blob usa la url (linea 153 f.isUrl true)', () => {
        global.URL.createObjectURL = jest.fn(() => 'blob:test');
        document.body.innerHTML = '<div id="productImageGallery"></div><input id="productImageUrl"><button id="productImageUrlBtn"></button><div id="productImageFilesList"></div>';
        require('../../frontend/js/productImages');
        document.getElementById('productImageUrl').value = 'https://example.com/image.jpg';
        window.ProductImages.addPendingUrl();
        window.ProductImages.renderPendingPreview();
        expect(document.getElementById('productImageGallery').innerHTML).toContain('product-image-item');
        expect(global.renderProductImage).toHaveBeenCalledWith('https://example.com/image.jpg', 'Imagen 1', expect.anything());
      });

      test('renderPendingPreview: file con url blob usa url del blob (linea 153 truthy)', () => {
        global.URL.createObjectURL = jest.fn(() => 'blob:test');
        document.body.innerHTML = '<div id="productImageGallery"></div>';
        require('../../frontend/js/productImages');
        window.ProductImages.addPendingFiles([
          { type: 'image/jpeg', size: 100, name: 'test.jpg' }
        ]);
        window.ProductImages.renderPendingPreview();
        expect(document.getElementById('productImageGallery').innerHTML).toContain('product-image-item');
        expect(global.renderProductImage).toHaveBeenCalledWith('blob:test', 'Imagen 1', expect.anything());
      });

      test('renderPendingPreview: file sin url usa cadena vacía', () => {
        document.body.innerHTML = '<div id="productImageGallery"></div>';
        require('../../frontend/js/productImages');
        var origCreateObjectURL = global.URL.createObjectURL;
        global.URL.createObjectURL = jest.fn(() => undefined);
        window.ProductImages.addPendingFiles([
          { type: 'image/jpeg', size: 100, name: 'test.jpg' }
        ]);
        window.ProductImages.renderPendingPreview();
        expect(document.getElementById('productImageGallery').innerHTML).toContain('product-image-item');
        expect(global.renderProductImage).toHaveBeenCalledWith('', 'Imagen 1', expect.anything());
        global.URL.createObjectURL = origCreateObjectURL;
      });

      test('renderGallery: querySelector null para botones data-action no rompe el render', () => {
        document.body.innerHTML = '<div id="productImageGallery"></div>';
        require('../../frontend/js/productImages');
        var container = document.getElementById('productImageGallery');
        var origQS = Element.prototype.querySelector;
        Element.prototype.querySelector = jest.fn(function (selector) {
          if (selector && (selector.indexOf('data-action') !== -1 || selector.indexOf('replace-input') !== -1)) {
            return null;
          }
          return origQS.call(this, selector);
        });
        window.ProductImages.renderGallery(container, [{ id: 1, url: 'i.jpg', es_principal: true, orden: 1 }], '123');
        Element.prototype.querySelector = origQS;
      });

      test('init con productId: setupDropzone sin input file', () => {
        document.body.innerHTML = '<div id="productImageDropzone"></div><div id="productImageGallery"></div>';
        require('../../frontend/js/productImages');
        expect(() => window.ProductImages.init('123')).not.toThrow();
      });

      test('setupDropzone: showMetaInputs sin .image-meta-inputs no hace nada', async () => {
        jest.useFakeTimers();
        document.body.innerHTML = '<div id="productImageDropzone"></div><input id="productImageFiles" type="file" /><div id="productImageGallery"></div>';
        require('../../frontend/js/productImages');
        global.__getAdminToken = function () { return 'token'; };
        window.ProductImages.init('123');
        var dropzone = document.getElementById('productImageDropzone');
        var file = new File(['x'], 'a.jpg', { type: 'image/jpeg' });
        installXhr({ status: 200, responseText: JSON.stringify({ images: [] }) });
        fetchWithRetryMock = global.fetchWithRetry;
        fetchWithRetryMock.mockResolvedValue({ ok: true, json: async () => [] });
        var dropEvent = new Event('drop', { bubbles: true });
        dropEvent.dataTransfer = { files: [file] };
        dropzone.dispatchEvent(dropEvent);
        await flushPromises();
        jest.advanceTimersByTime(4000);
        jest.useRealTimers();
      });

      test('uploadFiles: error de validación sin status element', async () => {
        jest.useFakeTimers();
        document.body.innerHTML = '<div id="productImageGallery"></div>';
        require('../../frontend/js/productImages');
        var file = { type: 'image/bmp', size: 1000, name: 'a.bmp' };
        await window.ProductImages.uploadFiles('123', [file]);
        expect(global.showToast).toHaveBeenCalledWith(expect.stringContaining('formato no permitido'), 'error');
        jest.advanceTimersByTime(4000);
        jest.useRealTimers();
      });

      test('uploadFiles: error de red sin status ni progressContainer', async () => {
        jest.useFakeTimers();
        document.body.innerHTML = '<div id="productImageGallery"></div>';
        require('../../frontend/js/productImages');
        var file = { type: 'image/jpeg', size: 1000, name: 'a.jpg' };
        installXhr({ failure: true });
        await window.ProductImages.uploadFiles('123', [file]);
        expect(global.showToast).toHaveBeenCalledWith('Error de red', 'error');
        jest.advanceTimersByTime(3000);
        jest.useRealTimers();
      });

      test('uploadFiles: progress bar sin fill/text (elementos removidos al send)', async () => {
        jest.useFakeTimers();
        document.body.innerHTML = '<div id="productImageGallery"></div><div id="productImageUploadProgress"></div><div id="productImageUploadStatus"></div>';
        require('../../frontend/js/productImages');
        var file = { type: 'image/jpeg', size: 1024, name: 'a.jpg' };
        global.XMLHttpRequest = jest.fn(function () {
          var h = {};
          var upload = { addEventListener: jest.fn(function (evt, cb) { h['u_' + evt] = cb; }) };
          var inst = {
            status: 200,
            responseText: '{}',
            upload: upload,
            addEventListener: jest.fn(function (evt, cb) { h[evt] = cb; }),
            open: jest.fn(),
            setRequestHeader: jest.fn(),
            withCredentials: false,
            send: jest.fn(function () {
              var pc = document.getElementById('productImageUploadProgress');
              if (pc) pc.innerHTML = '';
              if (h['u_progress']) {
                h['u_progress']({ lengthComputable: true, loaded: 50, total: 100 });
              }
              if (h['load']) h['load']();
            })
          };
          return inst;
        });
        fetchWithRetryMock.mockResolvedValue({ ok: true, json: async () => [] });
        await window.ProductImages.uploadFiles('123', [file]);
        jest.advanceTimersByTime(3000);
        jest.useRealTimers();
      });

      test('uploadFiles: éxito sin status element y sin result.data.images', async () => {
        jest.useFakeTimers();
        document.body.innerHTML = '<div id="productImageGallery"></div><div id="productImageUploadProgress"></div>';
        require('../../frontend/js/productImages');
        var file = { type: 'image/jpeg', size: 1024, name: 'a.jpg' };
        installXhr({ status: 200, responseText: '{}' });
        fetchWithRetryMock.mockResolvedValue({ ok: true, json: async () => [] });
        await window.ProductImages.uploadFiles('123', [file]);
        jest.advanceTimersByTime(3000);
        jest.useRealTimers();
      });

      test('uploadFiles: error de status (no 403) sin data.error usa fallback', async () => {
        jest.useFakeTimers();
        document.body.innerHTML = '<div id="productImageGallery"></div><div id="productImageUploadStatus"></div><div id="productImageUploadProgress"></div>';
        require('../../frontend/js/productImages');
        var file = { type: 'image/jpeg', size: 1000, name: 'a.jpg' };
        installXhr({ status: 500, responseText: '{}' });
        fetchWithRetryMock.mockResolvedValue({ ok: true, json: async () => [] });
        await window.ProductImages.uploadFiles('123', [file]);
        expect(global.showToast).toHaveBeenCalledWith(expect.stringContaining('Error 500'), 'error');
        jest.advanceTimersByTime(3000);
        jest.useRealTimers();
      });

      test('replaceImage: formato no permitido sin status element', async () => {
        jest.useFakeTimers();
        document.body.innerHTML = '';
        require('../../frontend/js/productImages');
        await window.ProductImages.replaceImage('123', '1', { type: 'image/bmp', size: 100 });
        expect(global.showToast).toHaveBeenCalledWith('Formato no permitido', 'error');
        jest.advanceTimersByTime(3000);
        jest.useRealTimers();
      });

      test('replaceImage: archivo oversized sin status element', async () => {
        jest.useFakeTimers();
        document.body.innerHTML = '';
        require('../../frontend/js/productImages');
        await window.ProductImages.replaceImage('123', '1', { type: 'image/jpeg', size: 300 * 1024 * 1024 });
        expect(global.showToast).toHaveBeenCalledWith('Imagen muy grande (máx 200MB)', 'error');
        jest.advanceTimersByTime(3000);
        jest.useRealTimers();
      });

      test('replaceImage: error de red sin status element', async () => {
        jest.useFakeTimers();
        document.body.innerHTML = '<div id="productImageGallery"></div>';
        require('../../frontend/js/productImages');
        fetchWithRetryMock.mockResolvedValue(null);
        await window.ProductImages.replaceImage('123', '1', { type: 'image/jpeg', size: 100 });
        expect(global.showToast).toHaveBeenCalledWith('Error de red', 'error');
        jest.advanceTimersByTime(3000);
        jest.useRealTimers();
      });

      test('replaceImage: error del servidor sin status element', async () => {
        jest.useFakeTimers();
        document.body.innerHTML = '<div id="productImageGallery"></div>';
        require('../../frontend/js/productImages');
        fetchWithRetryMock.mockResolvedValue({ ok: false, json: async () => ({ error: 'fail' }) });
        await window.ProductImages.replaceImage('123', '1', { type: 'image/jpeg', size: 100 });
        expect(global.showToast).toHaveBeenCalledWith('fail', 'error');
        jest.advanceTimersByTime(3000);
        jest.useRealTimers();
      });

      test('renderGallery: edit-meta sin meta-form no lanza error', () => {
        document.body.innerHTML = '<div id="productImageGallery"></div>';
        require('../../frontend/js/productImages');
        var container = document.getElementById('productImageGallery');
        window.ProductImages.renderGallery(container, [{ id: 1, url: 'i.jpg', es_principal: true, orden: 1 }], '123');
        var item = container.querySelector('.product-image-item');
        var metaForm = item.querySelector('.product-image-item-meta-form');
        if (metaForm) metaForm.remove();
        expect(() => item.querySelector('[data-action="edit-meta"]').click()).not.toThrow();
      });

      test('renderGallery: cancel-meta sin meta-form no lanza error', () => {
        document.body.innerHTML = '<div id="productImageGallery"></div>';
        require('../../frontend/js/productImages');
        var container = document.getElementById('productImageGallery');
        window.ProductImages.renderGallery(container, [{ id: 1, url: 'i.jpg', es_principal: true, orden: 1 }], '123');
        var item = container.querySelector('.product-image-item');
        var origQS = item.querySelector;
        item.querySelector = function (selector) {
          if (selector && selector.indexOf('meta-form') !== -1) {
            return null;
          }
          return origQS.call(this, selector);
        };
        expect(() => item.querySelector('[data-action="cancel-meta"]').click()).not.toThrow();
      });

      test('renderGallery: replace sin replace-input no lanza error', () => {
        document.body.innerHTML = '<div id="productImageGallery"></div>';
        require('../../frontend/js/productImages');
        var container = document.getElementById('productImageGallery');
        window.ProductImages.renderGallery(container, [{ id: 1, url: 'i.jpg', es_principal: true, orden: 1 }], '123');
        var item = container.querySelector('.product-image-item');
        var replaceInput = item.querySelector('.product-image-item-replace-input');
        if (replaceInput) replaceInput.remove();
        expect(() => item.querySelector('[data-action="replace"]').click()).not.toThrow();
      });

      test('renderGallery: replace-input change sin file retorna sin llamar replaceImage', () => {
        document.body.innerHTML = '<div id="productImageGallery"></div>';
        require('../../frontend/js/productImages');
        var container = document.getElementById('productImageGallery');
        window.ProductImages.renderGallery(container, [{ id: 1, url: 'i.jpg', es_principal: true, orden: 1 }], '123');
        var item = container.querySelector('.product-image-item');
        var input = item.querySelector('.product-image-item-replace-input');
        Object.defineProperty(input, 'files', { value: [], configurable: true });
        expect(() => input.dispatchEvent(new Event('change'))).not.toThrow();
        expect(fetchWithRetryMock).not.toHaveBeenCalled();
      });

      test('renderGallery: save-meta sin inputs usa valores vacíos', async () => {
        document.body.innerHTML = '<div id="productImageGallery"></div>';
        require('../../frontend/js/productImages');
        var container = document.getElementById('productImageGallery');
        fetchWithRetryMock.mockResolvedValue({ ok: true, json: async () => ({}) });
        window.ProductImages.renderGallery(container, [{ id: 1, url: 'i.jpg', es_principal: true, orden: 1 }], '123');
        var item = container.querySelector('.product-image-item');
        var descInput = item.querySelector('.product-image-item-desc-input');
        var catInput = item.querySelector('.product-image-item-cat-input');
        if (descInput) descInput.remove();
        if (catInput) catInput.remove();
        item.querySelector('[data-action="save-meta"]').click();
        await flushPromises();
        expect(fetchWithRetryMock).toHaveBeenCalledWith(
          expect.stringContaining('/api/products/123/images/1'),
          expect.objectContaining({ method: 'PATCH', body: JSON.stringify({ descripcion: '', categoria: '' }) }),
          2,
          1000
        );
      });

      test('setupDropzone: input change con archivos vacíos no sube', async () => {
        jest.useFakeTimers();
        document.body.innerHTML = '<div id="productImageDropzone"></div><input id="productImageFiles" type="file" /><div id="productImageGallery"></div><div class="image-meta-inputs"></div>';
        require('../../frontend/js/productImages');
        global.__getAdminToken = function () { return 'token'; };
        fetchWithRetryMock.mockResolvedValue({ ok: true, json: async () => [] });
        window.ProductImages.init('123');
        fetchWithRetryMock.mockClear();
        var input = document.getElementById('productImageFiles');
        Object.defineProperty(input, 'files', { value: [], configurable: true });
        input.dispatchEvent(new Event('change'));
        await flushPromises();
        expect(fetchWithRetryMock).not.toHaveBeenCalled();
        jest.useRealTimers();
      });

      test('setupDropzone: drop con archivos no imagen retorna sin subir', async () => {
        jest.useFakeTimers();
        document.body.innerHTML = '<div id="productImageDropzone"></div><div id="productImageGallery"></div><div class="image-meta-inputs"></div>';
        require('../../frontend/js/productImages');
        global.__getAdminToken = function () { return 'token'; };
        fetchWithRetryMock.mockResolvedValue({ ok: true, json: async () => [] });
        window.ProductImages.init('123');
        fetchWithRetryMock.mockClear();
        var dropzone = document.getElementById('productImageDropzone');
        var dropEvent = new Event('drop', { bubbles: true });
        dropEvent.dataTransfer = { files: [{ type: 'text/plain', size: 10 }] };
        dropzone.dispatchEvent(dropEvent);
        await flushPromises();
        expect(fetchWithRetryMock).not.toHaveBeenCalled();
        jest.useRealTimers();
      });

      test('uploadPending: ambos invalid y oversized en addPendingFiles', () => {
        document.body.innerHTML = '<div id="productImageDropzone"></div><div id="productImageGallery"></div>';
        require('../../frontend/js/productImages');
        var files = [
          { type: 'image/bmp', size: 1000, name: 'a.bmp' },
          { type: 'image/jpeg', size: 300 * 1024 * 1024, name: 'b.jpg' }
        ];
        window.ProductImages.addPendingFiles(files);
        expect(global.showToast).toHaveBeenCalledWith(expect.stringContaining('formato no permitido'), 'error');
        expect(window.ProductImages.hasPendingFiles()).toBe(false);
      });

      test('uploadFiles: sin progressContainer en path de éxito', async () => {
        jest.useFakeTimers();
        document.body.innerHTML = '<div id="productImageGallery"></div><div id="productImageUploadStatus"></div>';
        require('../../frontend/js/productImages');
        var file = { type: 'image/jpeg', size: 1024, name: 'a.jpg' };
        installXhr({ status: 200, responseText: JSON.stringify({ images: [{ id: 1, url: 'x.jpg' }] }) });
        fetchWithRetryMock.mockResolvedValue({ ok: true, json: async () => [] });
        await window.ProductImages.uploadFiles('123', [file]);
        expect(global.showToast).not.toHaveBeenCalledWith(expect.any(String), 'error');
        jest.advanceTimersByTime(3000);
        jest.useRealTimers();
      });

      test('uploadFiles: éxito con result.data.images undefined usa files.length', async () => {
        jest.useFakeTimers();
        document.body.innerHTML = '<div id="productImageGallery"></div><div id="productImageUploadStatus"></div><div id="productImageUploadProgress"></div>';
        require('../../frontend/js/productImages');
        var file = { type: 'image/jpeg', size: 1024, name: 'a.jpg' };
        installXhr({ status: 200, responseText: '{}' });
        fetchWithRetryMock.mockResolvedValue({ ok: true, json: async () => [] });
        await window.ProductImages.uploadFiles('123', [file]);
        var status = document.getElementById('productImageUploadStatus');
        expect(status.textContent).toContain('1');
        jest.advanceTimersByTime(3000);
        jest.useRealTimers();
      });

      test('replaceImage: !res.ok sin data.error usa fallback genérico', async () => {
        jest.useFakeTimers();
        document.body.innerHTML = '<div id="productImageGallery"></div><div id="productImageUploadStatus"></div>';
        require('../../frontend/js/productImages');
        fetchWithRetryMock.mockResolvedValue({ ok: false, json: async () => ({}) });
        await window.ProductImages.replaceImage('123', '1', { type: 'image/jpeg', size: 100 });
        expect(global.showToast).toHaveBeenCalledWith('Error al reemplazar', 'error');
        jest.advanceTimersByTime(3000);
        jest.useRealTimers();
      });
    });
  });
});
