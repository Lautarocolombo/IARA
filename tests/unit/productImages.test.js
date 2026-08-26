/**
 * Tests unitarios para productImages.js
 */

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

global.showToast = jest.fn();
global.renderProductImage = jest.fn(() => '<img src="" alt="product" />');
global.URL.createObjectURL = jest.fn(() => 'blob:test');

function createXhrMock(overrides = {}) {
  const listeners = {};
  const xhr = {
    readyState: 0,
    status: overrides.status || 200,
    responseText: overrides.responseText || '{"success":true}',
    upload: { addEventListener: jest.fn() },
    open: jest.fn(),
    setRequestHeader: jest.fn(),
    send: jest.fn(() => {
      setTimeout(() => {
        if (overrides.shouldFail) {
          xhr.readyState = 4;
          xhr.status = 500;
          xhr.responseText = '{"error":"Server error"}';
          if (listeners['error']) listeners['error'].forEach(cb => cb());
        } else {
          xhr.readyState = 4;
          xhr.status = overrides.status || 200;
          xhr.responseText = overrides.responseText || '{"success":true}';
          if (listeners['load']) listeners['load'].forEach(cb => cb());
        }
        if (listeners['progress']) {
          listeners['progress'].forEach(cb => cb({ lengthComputable: true, loaded: 50, total: 100 }));
        }
      }, 0);
    }),
    addEventListener: jest.fn((event, cb) => {
      if (!listeners[event]) listeners[event] = [];
      listeners[event].push(cb);
    })
  };
  return xhr;
}

describe('productImages.js', () => {
  let fetchWithRetryMock;
  let xhrMock;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
    fetchWithRetryMock = jest.fn();
    global.fetchWithRetry = fetchWithRetryMock;
    xhrMock = createXhrMock();
    global.XMLHttpRequest = jest.fn(() => xhrMock);
    document.body.innerHTML = '';
  });

  afterEach(() => {
    jest.clearAllMocks();
    delete global.XMLHttpRequest;
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

    test('agrega URL válida a pendientes', () => {
      document.body.innerHTML = `
        <input id="productImageUrl" value="https://example.com/image.jpg" />
        <button id="productImageUrlBtn"></button>
      `;
      require('../../frontend/js/productImages');
      window.ProductImages.addPendingUrl();
      expect(window.ProductImages.hasPendingFiles()).toBe(true);
      expect(global.showToast).toHaveBeenCalledWith('URL de imagen agregada', 'success');
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

    test('dragstart establece dataTransfer y clase dragging', () => {
      require('../../frontend/js/productImages');
      const container = document.createElement('div');
      container.id = 'productImageGallery';
      document.body.appendChild(container);
      const images = [{ id: 1, url: 'img1.jpg', descripcion: 'Test', es_principal: true, orden: 1 }];
      window.ProductImages.renderGallery(container, images, '123');
      const item = container.querySelector('.product-image-item');
      const event = new Event('dragstart');
      event.dataTransfer = { setData: jest.fn() };
      item.dispatchEvent(event);
      expect(item.classList.contains('dragging')).toBe(true);
    });

    test('dragover reordena items', () => {
      require('../../frontend/js/productImages');
      const container = document.createElement('div');
      container.id = 'productImageGallery';
      document.body.appendChild(container);
      const images = [
        { id: 1, url: 'img1.jpg', descripcion: 'A', es_principal: true, orden: 1 },
        { id: 2, url: 'img2.jpg', descripcion: 'B', es_principal: false, orden: 2 }
      ];
      window.ProductImages.renderGallery(container, images, '123');
      const items = container.querySelectorAll('.product-image-item');
      const dragging = items[0];
      dragging.classList.add('dragging');
      const over = items[1];
      const event = new Event('dragover');
      event.clientY = over.getBoundingClientRect().top + over.getBoundingClientRect().height / 2 - 1;
      over.dispatchEvent(event);
      expect(container.contains(dragging)).toBe(true);
    });

    test('drop en item llama syncOrder y loadImages', async () => {
      require('../../frontend/js/productImages');
      const container = document.createElement('div');
      container.id = 'productImageGallery';
      document.body.appendChild(container);
      const images = [{ id: 1, url: 'img1.jpg', descripcion: 'Test', es_principal: true, orden: 1 }];
      window.ProductImages.renderGallery(container, images, '123');
      const item = container.querySelector('.product-image-item');
      const event = new Event('drop');
      event.preventDefault = jest.fn();
      Object.defineProperty(event, 'preventDefault', { value: jest.fn() });
      item.dispatchEvent(event);
      expect(fetchWithRetryMock).toHaveBeenCalledWith(
        expect.stringContaining('/api/products/123/images/sync-order'),
        expect.objectContaining({ method: 'POST' }),
        2,
        1000
      );
    });

    test('click en botón principal marca imagen principal', async () => {
      require('../../frontend/js/productImages');
      const container = document.createElement('div');
      container.id = 'productImageGallery';
      document.body.appendChild(container);
      const images = [{ id: 1, url: 'img1.jpg', descripcion: 'Test', es_principal: false, orden: 1 }];
      window.ProductImages.renderGallery(container, images, '123');
      const btn = container.querySelector('[data-action="principal"]');
      btn.click();
      expect(fetchWithRetryMock).toHaveBeenCalledWith(
        expect.stringContaining('/api/products/123/images/1'),
        expect.objectContaining({ method: 'PATCH', body: JSON.stringify({ es_principal: true }) }),
        2,
        1000
      );
    });

    test('click en botón editar metadatos muestra formulario', () => {
      require('../../frontend/js/productImages');
      const container = document.createElement('div');
      container.id = 'productImageGallery';
      document.body.appendChild(container);
      const images = [{ id: 1, url: 'img1.jpg', descripcion: 'Test', es_principal: true, orden: 1 }];
      window.ProductImages.renderGallery(container, images, '123');
      const btn = container.querySelector('[data-action="edit-meta"]');
      btn.click();
      const metaForm = container.querySelector('.product-image-item-meta-form');
      expect(metaForm.style.display).toBe('block');
    });

    test('click en botón guardar metadatos actualiza', async () => {
      require('../../frontend/js/productImages');
      const container = document.createElement('div');
      container.id = 'productImageGallery';
      document.body.appendChild(container);
      const images = [{ id: 1, url: 'img1.jpg', descripcion: 'Old', categoria: 'accesorios', es_principal: true, orden: 1 }];
      window.ProductImages.renderGallery(container, images, '123');
      const descInput = container.querySelector('.product-image-item-desc-input');
      const saveBtn = container.querySelector('[data-action="save-meta"]');
      descInput.value = 'Nueva desc';
      saveBtn.click();
      expect(fetchWithRetryMock).toHaveBeenCalledWith(
        expect.stringContaining('/api/products/123/images/1'),
        expect.objectContaining({ method: 'PATCH', body: JSON.stringify({ descripcion: 'Nueva desc', categoria: 'accesorios' }) }),
        2,
        1000
      );
    });

    test('click en botón cancelar metadatos oculta formulario', () => {
      require('../../frontend/js/productImages');
      const container = document.createElement('div');
      container.id = 'productImageGallery';
      document.body.appendChild(container);
      const images = [{ id: 1, url: 'img1.jpg', descripcion: 'Test', es_principal: true, orden: 1 }];
      window.ProductImages.renderGallery(container, images, '123');
      const editBtn = container.querySelector('[data-action="edit-meta"]');
      editBtn.click();
      const metaForm = container.querySelector('.product-image-item-meta-form');
      expect(metaForm.style.display).toBe('block');
      const cancelBtn = container.querySelector('[data-action="cancel-meta"]');
      cancelBtn.click();
      expect(metaForm.style.display).toBe('none');
    });

    test('click en botón reemplazar dispara input de archivo', () => {
      require('../../frontend/js/productImages');
      const container = document.createElement('div');
      container.id = 'productImageGallery';
      document.body.appendChild(container);
      const images = [{ id: 1, url: 'img1.jpg', descripcion: 'Test', es_principal: true, orden: 1 }];
      window.ProductImages.renderGallery(container, images, '123');
      const replaceBtn = container.querySelector('[data-action="replace"]');
      const input = container.querySelector('.product-image-item-replace-input');
      const clickSpy = jest.spyOn(input, 'click');
      replaceBtn.click();
      expect(clickSpy).toHaveBeenCalled();
    });

    test('cambio en input reemplazar llama replaceImage', async () => {
      require('../../frontend/js/productImages');
      const container = document.createElement('div');
      container.id = 'productImageGallery';
      document.body.appendChild(container);
      const images = [{ id: 1, url: 'img1.jpg', descripcion: 'Test', es_principal: true, orden: 1 }];
      window.ProductImages.renderGallery(container, images, '123');
      const input = container.querySelector('.product-image-item-replace-input');
      const file = new File([''], 'test.jpg', { type: 'image/jpeg' });
      const event = new Event('change');
      Object.defineProperty(event, 'target', { value: { files: [file], value: '' } });
      input.dispatchEvent(event);
      expect(fetchWithRetryMock).toHaveBeenCalledWith(
        expect.stringContaining('/api/products/123/images/1/replace'),
        expect.objectContaining({ method: 'PUT' }),
        2,
        1000
      );
    });

    test('click en botón eliminar llama deleteImage', async () => {
      require('../../frontend/js/productImages');
      const container = document.createElement('div');
      container.id = 'productImageGallery';
      document.body.appendChild(container);
      const images = [{ id: 1, url: 'img1.jpg', descripcion: 'Test', es_principal: true, orden: 1 }];
      window.ProductImages.renderGallery(container, images, '123');
      const deleteBtn = container.querySelector('[data-action="delete"]');
      deleteBtn.click();
      expect(fetchWithRetryMock).toHaveBeenCalledWith(
        expect.stringContaining('/api/products/123/images/1'),
        expect.objectContaining({ method: 'DELETE' }),
        2,
        1000
      );
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
      require('../../frontend/js/productImages');
      const result = await window.ProductImages.uploadPending('123');
      expect(result).toBe(0);
    });

    test('retorna 0 si no hay productId', async () => {
      require('../../frontend/js/productImages');
      const result = await window.ProductImages.uploadPending('');
      expect(result).toBe(0);
    });

    test('sube archivos pendientes exitosamente', async () => {
      document.body.innerHTML = `
        <div id="productImageDropzone"></div>
        <div id="productImageGallery"></div>
        <div id="productImageFilesList"></div>
      `;
      require('../../frontend/js/productImages');
      window.ProductImages.addPendingFiles([
        { type: 'image/jpeg', size: 1024, name: 'test.jpg', file: {} }
      ]);
      xhrMock = createXhrMock({ status: 200, responseText: '{"images":[{"id":1}]}' });
      global.XMLHttpRequest = jest.fn(() => xhrMock);
      const result = await window.ProductImages.uploadPending('123');
      expect(result).toBe(1);
      expect(xhrMock.open).toHaveBeenCalledWith('POST', expect.stringContaining('/api/products/123/images'));
    });

    test('maneja error de red al subir', async () => {
      document.body.innerHTML = `
        <div id="productImageDropzone"></div>
        <div id="productImageGallery"></div>
        <div id="productImageFilesList"></div>
      `;
      require('../../frontend/js/productImages');
      window.ProductImages.addPendingFiles([
        { type: 'image/jpeg', size: 1024, name: 'test.jpg', file: {} }
      ]);
      xhrMock = createXhrMock({ shouldFail: true });
      global.XMLHttpRequest = jest.fn(() => xhrMock);
      const result = await window.ProductImages.uploadPending('123');
      expect(result).toBe(0);
    });
  });

  describe('setupPendingDropzone', () => {
    test('drop de archivos imagen agrega pendientes', () => {
      document.body.innerHTML = `
        <div id="productImageDropzone"></div>
        <div id="productImageGallery"></div>
      `;
      require('../../frontend/js/productImages');
      window.ProductImages.init();
      const dropzone = document.getElementById('productImageDropzone');
      const file = { type: 'image/jpeg', size: 1024, name: 'test.jpg' };
      const event = new Event('drop');
      Object.defineProperty(event, 'dataTransfer', { value: { files: [file] } });
      dropzone.dispatchEvent(event);
      expect(window.ProductImages.hasPendingFiles()).toBe(true);
    });

    test('change en input de archivos agrega pendientes', () => {
      document.body.innerHTML = `
        <div id="productImageDropzone"></div>
        <div id="productImageGallery"></div>
        <input id="productImageFiles" type="file" />
      `;
      require('../../frontend/js/productImages');
      window.ProductImages.init();
      const input = document.getElementById('productImageFiles');
      const file = { type: 'image/jpeg', size: 1024, name: 'test.jpg' };
      Object.defineProperty(input, 'files', { value: [file] });
      const event = new Event('change');
      input.dispatchEvent(event);
      expect(window.ProductImages.hasPendingFiles()).toBe(true);
    });
  });

  describe('setupUrlPaste', () => {
    test('click en botón URL agrega pendiente', () => {
      document.body.innerHTML = `
        <div id="productImageDropzone"></div>
        <div id="productImageGallery"></div>
        <input id="productImageUrl" value="https://example.com/image.jpg" />
        <button id="productImageUrlBtn"></button>
      `;
      require('../../frontend/js/productImages');
      window.ProductImages.init();
      const btn = document.getElementById('productImageUrlBtn');
      btn.click();
      expect(window.ProductImages.hasPendingFiles()).toBe(true);
    });

    test('Enter en input URL agrega pendiente', () => {
      document.body.innerHTML = `
        <div id="productImageDropzone"></div>
        <div id="productImageGallery"></div>
        <input id="productImageUrl" value="https://example.com/image.jpg" />
        <button id="productImageUrlBtn"></button>
      `;
      require('../../frontend/js/productImages');
      window.ProductImages.init();
      const input = document.getElementById('productImageUrl');
      const event = new KeyboardEvent('keydown', { key: 'Enter' });
      event.preventDefault = jest.fn();
      input.dispatchEvent(event);
      expect(window.ProductImages.hasPendingFiles()).toBe(true);
    });
  });

  describe('uploadFiles', () => {
    test('sube archivos exitosamente', async () => {
      document.body.innerHTML = `
        <div id="productImageDropzone"></div>
        <div id="productImageGallery"></div>
        <div id="productImageUploadStatus"></div>
        <div id="productImageUploadProgress"></div>
        <input id="pImageDescripcion" value="desc" />
        <input id="pImageCategoria" value="pulseras" />
      `;
      require('../../frontend/js/productImages');
      const file = { type: 'image/jpeg', size: 1024, name: 'test.jpg' };
      xhrMock = createXhrMock({ status: 200, responseText: '{"images":[{"id":1}]}' });
      global.XMLHttpRequest = jest.fn(() => xhrMock);
      await window.ProductImages.uploadFiles('123', [file]);
      expect(fetchWithRetryMock).toHaveBeenCalledWith('/api/products/123/images', {}, 2, 1000);
    });

    test('maneja error al subir archivos', async () => {
      document.body.innerHTML = `
        <div id="productImageDropzone"></div>
        <div id="productImageGallery"></div>
        <div id="productImageUploadStatus"></div>
        <div id="productImageUploadProgress"></div>
      `;
      require('../../frontend/js/productImages');
      const file = { type: 'image/jpeg', size: 1024, name: 'test.jpg' };
      xhrMock = createXhrMock({ shouldFail: true });
      global.XMLHttpRequest = jest.fn(() => xhrMock);
      await window.ProductImages.uploadFiles('123', [file]);
      expect(global.showToast).toHaveBeenCalled();
    });

    test('rechaza formato no permitido', async () => {
      document.body.innerHTML = `
        <div id="productImageUploadStatus"></div>
      `;
      require('../../frontend/js/productImages');
      const file = { type: 'image/bmp', size: 1024, name: 'test.bmp' };
      await window.ProductImages.uploadFiles('123', [file]);
      expect(global.showToast).toHaveBeenCalledWith(expect.stringContaining('formato no permitido'), 'error');
    });

    test('rechaza archivo muy grande', async () => {
      document.body.innerHTML = `
        <div id="productImageUploadStatus"></div>
      `;
      require('../../frontend/js/productImages');
      const file = { type: 'image/jpeg', size: 300 * 1024 * 1024, name: 'test.jpg' };
      await window.ProductImages.uploadFiles('123', [file]);
      expect(global.showToast).toHaveBeenCalledWith(expect.stringContaining('200MB'), 'error');
    });
  });

  describe('setupDropzone', () => {
    test('drop de archivos imagen con productId', () => {
      document.body.innerHTML = `
        <div id="productImageDropzone"></div>
        <div id="productImageGallery"></div>
      `;
      require('../../frontend/js/productImages');
      window.ProductImages.init('123');
      const dropzone = document.getElementById('productImageDropzone');
      const file = { type: 'image/jpeg', size: 1024, name: 'test.jpg' };
      const event = new Event('drop');
      Object.defineProperty(event, 'dataTransfer', { value: { files: [file] } });
      dropzone.dispatchEvent(event);
    });

    test('change en input de archivos con productId', async () => {
      document.body.innerHTML = `
        <div id="productImageDropzone"></div>
        <div id="productImageGallery"></div>
        <input id="productImageFiles" type="file" />
      `;
      require('../../frontend/js/productImages');
      window.ProductImages.init('123');
      const input = document.getElementById('productImageFiles');
      const file = { type: 'image/jpeg', size: 1024, name: 'test.jpg' };
      Object.defineProperty(input, 'files', { value: [file] });
      const event = new Event('change');
      input.dispatchEvent(event);
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

    test('rechaza archivo muy grande', async () => {
      window.fetchWithRetry = jest.fn();
      require('../../frontend/js/productImages');
      const file = { type: 'image/jpeg', size: 300 * 1024 * 1024 };
      await window.ProductImages.replaceImage('123', '1', file);
      expect(window.fetchWithRetry).not.toHaveBeenCalled();
    });

    test('maneja error al reemplazar', async () => {
      window.fetchWithRetry = jest.fn().mockResolvedValue({ ok: false, json: async () => ({ error: 'Fail' }) });
      require('../../frontend/js/productImages');
      const file = { type: 'image/jpeg', size: 1024 };
      await window.ProductImages.replaceImage('123', '1', file);
      expect(global.showToast).toHaveBeenCalled();
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

    test('maneja error al marcar principal', async () => {
      window.fetchWithRetry = jest.fn().mockResolvedValue({ ok: false, json: async () => ({ error: 'Fail' }) });
      require('../../frontend/js/productImages');
      await window.ProductImages.markPrincipal('123', '1');
      expect(global.showToast).toHaveBeenCalled();
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

    test('maneja error al actualizar metadatos', async () => {
      window.fetchWithRetry = jest.fn().mockResolvedValue({ ok: false, json: async () => ({ error: 'Fail' }) });
      require('../../frontend/js/productImages');
      await window.ProductImages.updateImageMeta('123', '1', { descripcion: 'Nueva desc', categoria: 'pulseras' });
      expect(global.showToast).toHaveBeenCalled();
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

    test('maneja error al sincronizar orden', async () => {
      window.fetchWithRetry = jest.fn().mockRejectedValue(new Error('Network error'));
      require('../../frontend/js/productImages');
      await window.ProductImages.syncOrder('123', [1, 2, 3]);
      expect(global.showToast).toHaveBeenCalled();
    });
  });

  describe('getAuthToken', () => {
    test('retorna token cuando __getAdminToken existe', () => {
      window.__getAdminToken = jest.fn(() => 'token123');
      require('../../frontend/js/productImages');
      const result = window.ProductImages.getAuthToken();
      expect(result).toBe('token123');
    });

    test('retorna string vacío cuando __getAdminToken no existe', () => {
      delete window.__getAdminToken;
      require('../../frontend/js/productImages');
      const result = window.ProductImages.getAuthToken();
      expect(result).toBe('');
    });
  });
});
