/**
 * @jest-environment jsdom
 */

describe('Admin content - image previews', () => {
  var siteTexts;

  beforeEach(() => {
    jest.resetModules();
    global.CONFIG = {
      API: { BASE: 'http://localhost', BACKEND_URL: 'http://localhost' },
      ANIMATIONS: { TOAST_DURATION: 3000, REVEAL_THRESHOLD: 0.15, TRANSITION_SPEED: 0.4 }
    };
    siteTexts = {};
    delete window.__contentImageCleanupBound;
    document.body.innerHTML = `
      <div id="contentTabsNav"></div>
      <div class="content-tab-panel active" data-content-tab="home-blocks"><div class="card"><div class="card-body">
        <div class="admin-section-title">Bloque 1 - Hero Principal</div>
        <div class="home-block">
          <div class="form-grid-2">
            <div class="form-group"><label>Título</label><input type="text" id="hero_title" /></div>
            <div class="form-group"><label>Descripción</label><input type="text" id="hero_subtitle" /></div>
          </div>
          <div class="home-block-image-card">
            <label>Imagen destacada</label>
            <div class="hero-image-editor">
              <div class="hero-image-preview-row">
                <div class="hero-image-preview">
                  <img id="heroImagePreview" src="" alt="Preview imagen hero" style="display:none;" />
                  <div id="heroImagePlaceholder" class="hero-image-placeholder"><span>Sin imagen</span></div>
                </div>
                <div class="hero-image-actions">
                  <input type="file" id="heroImageInput" accept="image/jpeg,image/png,image/webp" />
                  <button type="button" class="btn" id="heroImageChangeBtn">Cambiar imagen</button>
                  <button type="button" class="btn" id="heroImageRemoveBtn">Quitar imagen</button>
                </div>
              </div>
              <div class="hero-image-new-preview hidden" id="heroImageNewPreview">
                <p class="hero-image-new-label">Vista previa nueva imagen:</p>
                <img id="heroImageNewImg" src="" alt="Nueva imagen hero" />
              </div>
              <div id="heroImageError" class="hero-image-error" style="display:none;"></div>
            </div>
          </div>
        </div>
        <div class="admin-section-title">Bloque 2 - Producto Destacado</div>
        <div class="home-block">
          <div class="form-grid-2">
            <input type="text" id="fp_name" /><input type="text" id="fp_description" />
          </div>
          <div class="home-block-image-card">
            <label>Imagen del producto</label>
            <div class="hero-image-editor">
              <div class="hero-image-preview-row">
                <div class="hero-image-preview">
                  <img id="fpImagePreview" src="" alt="Preview imagen producto" style="display:none;" />
                  <div id="fpImagePlaceholder" class="hero-image-placeholder"><span>Sin imagen</span></div>
                </div>
                <div class="hero-image-actions">
                  <input type="file" id="fpImageInput" accept="image/jpeg,image/png,image/webp" />
                  <button type="button" class="btn" id="fpImageChangeBtn">Cambiar imagen</button>
                  <button type="button" class="btn" id="fpImageRemoveBtn">Quitar imagen</button>
                </div>
              </div>
              <div class="hero-image-new-preview hidden" id="fpImageNewPreview"><img id="fpImageNewImg" src="" alt="Nuevo producto" /></div>
              <div id="fpImageError" class="hero-image-error" style="display:none;"></div>
            </div>
          </div>
        </div>
        <button id="saveHomeBlocksBtn"><span id="saveHomeBlocksBtnText">Guardar</span><span id="saveHomeBlocksBtnLoading" class="hidden">Guardando...</span></button>
      </div></div></div>
    `;

    window.adminFetch = jest.fn(function (url) {
      if (url === '/api/site-texts') {
        return Promise.resolve({ ok: true, json: function () { return Promise.resolve(siteTexts); } });
      }
      if (url === '/api/admin/settings') {
        return Promise.resolve({ ok: true, json: function () { return Promise.resolve({}); } });
      }
      if (url === '/api/admin/categories') {
        return Promise.resolve({ ok: true, json: function () { return Promise.resolve([]); } });
      }
      return Promise.resolve({ ok: true, json: function () { return Promise.resolve({}); } });
    });
    window.markDirty = jest.fn();
    window.showToast = jest.fn();
    delete window.refreshAllSaveButtons;

    window.URL.createObjectURL = jest.fn(function (file) { return 'blob://preview'; });
    window.URL.revokeObjectURL = jest.fn();
  });

  it('carga el editor sin errores', () => {
    require('../js/admin-content.js');
    expect(typeof window.initContentEditor).toBe('function');
  });

  it('muestra la imagen guardada en el recuadro tras cargar (no queda gris)', async () => {
    require('../js/admin-content.js');
    siteTexts = {
      hero_image_url: 'https://ex.com/hero.webp',
      featured_product_image_url: 'https://ex.com/fp.webp'
    };

    window.initContentEditor();
    await window.reloadContent();

    var heroImg = document.getElementById('heroImagePreview');
    expect(heroImg.getAttribute('src')).toBe('https://ex.com/hero.webp');
    expect(heroImg.style.display).toBe('block');
    expect(document.getElementById('heroImagePlaceholder').style.display).toBe('none');

    var fpImg = document.getElementById('fpImagePreview');
    expect(fpImg.getAttribute('src')).toBe('https://ex.com/fp.webp');
    expect(fpImg.style.display).toBe('block');
  });

  it('muestra preview inmediato al seleccionar un archivo, antes de guardar', async () => {
    require('../js/admin-content.js');
    window.initContentEditor();
    await window.reloadContent();

    var input = document.getElementById('heroImageInput');
    var file = new File(['fake-bytes'], 'foto.png', { type: 'image/png' });
    Object.defineProperty(input, 'files', { value: [file], configurable: true });
    input.dispatchEvent(new Event('change'));

    var heroImg = document.getElementById('heroImagePreview');
    expect(window.URL.createObjectURL).toHaveBeenCalledWith(file);
    expect(heroImg.getAttribute('src')).toBe('blob://preview');
    expect(heroImg.style.display).toBe('block');
    expect(document.getElementById('heroImagePlaceholder').style.display).toBe('none');
  });

  it('Quitar imagen limpia el preview, marca remove y revoca el objectURL', async () => {
    require('../js/admin-content.js');
    window.initContentEditor();
    await window.reloadContent();

    var input = document.getElementById('heroImageInput');
    var file = new File(['fake-bytes'], 'foto.png', { type: 'image/png' });
    Object.defineProperty(input, 'files', { value: [file], configurable: true });
    input.dispatchEvent(new Event('change'));

    var removeBtn = document.getElementById('heroImageRemoveBtn');
    removeBtn.dispatchEvent(new Event('click'));

    var heroImg = document.getElementById('heroImagePreview');
    expect(heroImg.getAttribute('src')).toBe('');
    expect(heroImg.style.display).toBe('none');
    expect(document.getElementById('heroImagePlaceholder').style.display).toBe('flex');
    expect(removeBtn.dataset.remove).toBe('true');
    expect(window.URL.revokeObjectURL).toHaveBeenCalledWith('blob://preview');
  });

  it('rechaza un archivo que no es imagen y muestra error sin crear objectURL', async () => {
    var createSpy = window.URL.createObjectURL;
    require('../js/admin-content.js');
    window.initContentEditor();
    await window.reloadContent();

    var input = document.getElementById('heroImageInput');
    var file = new File(['texto'], 'nota.txt', { type: 'text/plain' });
    Object.defineProperty(input, 'files', { value: [file], configurable: true });
    input.dispatchEvent(new Event('change'));

    var heroImg = document.getElementById('heroImagePreview');
    expect(heroImg.style.display).toBe('none');
    expect(document.getElementById('heroImageError').style.display).toBe('block');
    expect(window.URL.createObjectURL).not.toHaveBeenCalled();
  });
});
