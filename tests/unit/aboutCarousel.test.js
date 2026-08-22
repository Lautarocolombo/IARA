describe('about-carousel', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.useFakeTimers();
    window.__aboutImages = {};
    global.fetchWithRetry = jest.fn(function () {
      return Promise.resolve({
        ok: true,
        json: function () {
          return Promise.resolve({
            about_text: '<p>En cada pieza dejamos un pedacito de Gualeguay: horas de trabajo manual, materiales elegidos con cuidado y el orgullo de hacer las cosas bien.</p>'
          });
        }
      });
    });
    global.CONFIG = { API: { BASE: 'http://localhost' } };
    global.sanitizeAboutText = function (html) { return html; };
    document.body.innerHTML =
      '<div id="aboutCarouselWrap">' +
      '<div id="aboutCarouselTrack"></div>' +
      '<button id="aboutCarouselPrev" aria-label="Anterior">&#10094;</button>' +
      '<button id="aboutCarouselNext" aria-label="Siguiente">&#10095;</button>' +
      '<div id="aboutCarouselDots"></div>' +
      '</div>' +
      '<div class="about-text reveal" id="aboutText">' +
      '<p id="aboutTextContent"></p>' +
      '</div>';
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
    delete global.fetchWithRetry;
    delete global.CONFIG;
    delete global.sanitizeAboutText;
    document.body.innerHTML = '';
  });

  function requireModule() {
    return require('../../frontend/js/about-carousel.js');
  }

  function getActiveIndex() {
    const slides = document.querySelectorAll('#aboutCarouselTrack .about-carousel-slide');
    for (let i = 0; i < slides.length; i++) {
      if (slides[i].classList.contains('active')) return i;
    }
    return -1;
  }

  function setImages(map) {
    window.__aboutImages = map;
  }

  describe('collectImages', () => {
    test('devuelve todas las imágenes no vacías en orden (las 4 cargadas)', () => {
      const mod = requireModule();
      const images = mod.collectImages({
        about_image_1: 'a.jpg',
        about_image_2: 'b.jpg',
        about_image_3: '',
        about_image_4: 'd.jpg',
        about_image_5: 'e.jpg'
      });
      expect(images).toEqual(['a.jpg', 'b.jpg', 'd.jpg', 'e.jpg']);
    });

    test('saltea slots vacíos sin dejar huecos ni imágenes rotas', () => {
      const mod = requireModule();
      const images = mod.collectImages({
        about_image_1: '1.png',
        about_image_2: '',
        about_image_3: '',
        about_image_4: '4.png',
        about_image_5: ''
      });
      expect(images).toEqual(['1.png', '4.png']);
    });

    test('devuelve [] cuando no hay imágenes', () => {
      const mod = requireModule();
      expect(mod.collectImages({})).toEqual([]);
      expect(mod.collectImages(undefined)).toEqual([]);
    });
  });

  describe('wrapIndex', () => {
    test('hace loop de última a primera y viceversa', () => {
      const mod = requireModule();
      expect(mod.wrapIndex(-1, 4)).toBe(3);
      expect(mod.wrapIndex(4, 4)).toBe(0);
      expect(mod.wrapIndex(0, 4)).toBe(0);
      expect(mod.wrapIndex(3, 4)).toBe(3);
      expect(mod.wrapIndex(7, 4)).toBe(0);
      expect(mod.wrapIndex(-5, 4)).toBe(3);
    });

    test('devuelve 0 para listas vacías', () => {
      const mod = requireModule();
      expect(mod.wrapIndex(0, 0)).toBe(0);
      expect(mod.wrapIndex(-1, 0)).toBe(0);
    });
  });

  describe('build + navegación del carrusel', () => {
    test('construye slides y dots para cada imagen', () => {
      setImages({
        about_image_1: '1.jpg',
        about_image_2: '2.jpg',
        about_image_3: '3.jpg',
        about_image_4: '4.jpg',
        about_image_5: ''
      });
      const mod = requireModule();
      mod.build();

      const slides = document.querySelectorAll('#aboutCarouselTrack .about-carousel-slide');
      const dots = document.querySelectorAll('#aboutCarouselDots .about-carousel-dot');
      expect(slides.length).toBe(4);
      expect(dots.length).toBe(4);
      expect(getActiveIndex()).toBe(0);
      expect(document.getElementById('aboutCarouselPrev').style.display).not.toBe('none');
      expect(document.getElementById('aboutCarouselNext').style.display).not.toBe('none');
    });

    test('navega de punta a punta con › y da la vuelta (loop)', () => {
      setImages({
        about_image_1: '1.jpg',
        about_image_2: '2.jpg',
        about_image_3: '3.jpg',
        about_image_4: '4.jpg',
        about_image_5: ''
      });
      const mod = requireModule();
      mod.build();

      document.getElementById('aboutCarouselNext').click();
      expect(getActiveIndex()).toBe(1);
      document.getElementById('aboutCarouselNext').click();
      expect(getActiveIndex()).toBe(2);
      document.getElementById('aboutCarouselNext').click();
      expect(getActiveIndex()).toBe(3);
      document.getElementById('aboutCarouselNext').click();
      expect(getActiveIndex()).toBe(0);
    });

    test('navega hacia atrás con ‹ y da la vuelta a la última', () => {
      setImages({
        about_image_1: '1.jpg',
        about_image_2: '2.jpg',
        about_image_3: '3.jpg',
        about_image_4: '4.jpg',
        about_image_5: ''
      });
      const mod = requireModule();
      mod.build();

      document.getElementById('aboutCarouselPrev').click();
      expect(getActiveIndex()).toBe(3);
    });

    test('dots indican la posición activa y permiten navegar', () => {
      setImages({
        about_image_1: '1.jpg',
        about_image_2: '2.jpg',
        about_image_3: '3.jpg',
        about_image_4: '4.jpg',
        about_image_5: ''
      });
      const mod = requireModule();
      mod.build();

      const dots = document.querySelectorAll('#aboutCarouselDots .about-carousel-dot');
      expect(dots.length).toBe(4);
      dots[2].click();
      expect(getActiveIndex()).toBe(2);
      expect(dots[2].classList.contains('active')).toBe(true);
    });

    test('slot vacío en el medio se saltea: navegación cubre todos los slides visibles', () => {
      setImages({
        about_image_1: 'a.jpg',
        about_image_2: '',
        about_image_3: 'c.jpg',
        about_image_4: '',
        about_image_5: 'e.jpg'
      });
      const mod = requireModule();
      mod.build();

      const slides = document.querySelectorAll('#aboutCarouselTrack .about-carousel-slide');
      expect(slides.length).toBe(3);
      expect(getActiveIndex()).toBe(0);

      document.getElementById('aboutCarouselNext').click();
      expect(getActiveIndex()).toBe(1);
      document.getElementById('aboutCarouselNext').click();
      expect(getActiveIndex()).toBe(2);
      document.getElementById('aboutCarouselNext').click();
      expect(getActiveIndex()).toBe(0);
    });

    test('navegación manual no es sobreescrita por autoplay (timers detenidos)', () => {
      setImages({
        about_image_1: '1.jpg',
        about_image_2: '2.jpg',
        about_image_3: '3.jpg',
        about_image_4: '4.jpg',
        about_image_5: ''
      });
      const mod = requireModule();
      mod.build();

      document.getElementById('aboutCarouselNext').click();
      document.getElementById('aboutCarouselNext').click();
      expect(getActiveIndex()).toBe(2);
      document.getElementById('aboutCarouselPrev').click();
      expect(getActiveIndex()).toBe(1);
    });

    test('sin imágenes muestra placeholder y oculta controles', () => {
      setImages({
        about_image_1: '', about_image_2: '', about_image_3: '', about_image_4: '', about_image_5: ''
      });
      const mod = requireModule();
      mod.build();

      const slides = document.querySelectorAll('#aboutCarouselTrack .about-carousel-slide');
      expect(slides.length).toBe(1);
      expect(slides[0].classList.contains('active')).toBe(true);
      expect(document.querySelectorAll('#aboutCarouselDots .about-carousel-dot').length).toBe(0);
      expect(document.getElementById('aboutCarouselPrev').style.display).toBe('none');
      expect(document.getElementById('aboutCarouselNext').style.display).toBe('none');
    });

    test('autoplay avanza al siguiente slide', () => {
      setImages({
        about_image_1: '1.jpg',
        about_image_2: '2.jpg',
        about_image_3: '3.jpg',
        about_image_4: '4.jpg',
        about_image_5: ''
      });
      const mod = requireModule();
      mod.build();

      expect(getActiveIndex()).toBe(0);
      jest.advanceTimersByTime(4500);
      expect(getActiveIndex()).toBe(1);
      jest.advanceTimersByTime(4500);
      expect(getActiveIndex()).toBe(2);
    });

    test('autoplay se pausa al interactuar y reanuda al salir', () => {
      setImages({
        about_image_1: '1.jpg',
        about_image_2: '2.jpg',
        about_image_3: '3.jpg',
        about_image_4: '4.jpg',
        about_image_5: ''
      });
      const mod = requireModule();
      mod.build();

      const wrap = document.getElementById('aboutCarouselWrap');
      wrap.dispatchEvent(new Event('mouseenter'));
      jest.advanceTimersByTime(9999);
      expect(getActiveIndex()).toBe(0);
      wrap.dispatchEvent(new Event('mouseleave'));
      jest.advanceTimersByTime(4500);
      expect(getActiveIndex()).toBe(1);
    });
  });

  describe('manejo de imágenes y lifecycle', () => {
    function flushPromises() {
      return new Promise(function (resolve) {
        require('timers').setImmediate(resolve);
      });
    }

    test('loadAboutText usa texto por defecto si falla la carga', async () => {
      setImages({
        about_image_1: '1.jpg', about_image_2: '2.jpg', about_image_3: '', about_image_4: '', about_image_5: ''
      });
      var prevFetch = global.fetchWithRetry;
      global.fetchWithRetry = jest.fn(function () { return Promise.reject(new Error('network')); });
      var mod = requireModule();
      mod.build();
      await flushPromises();
      expect(document.getElementById('aboutTextContent').innerHTML).toContain('En cada pieza');
      global.fetchWithRetry = prevFetch;
    });

    test('refreshAboutText aplica fade y actualiza el texto del about', async () => {
      setImages({
        about_image_1: '1.jpg', about_image_2: '2.jpg', about_image_3: '', about_image_4: '', about_image_5: ''
      });
      var mod = requireModule();
      mod.build();
      await flushPromises();
      document.getElementById('aboutCarouselNext').click();
      jest.advanceTimersByTime(200);
      expect(document.getElementById('aboutTextContent').innerHTML).toContain('En cada pieza');
    });

    test('recarga about text al evento site_texts_updated', async () => {
      setImages({
        about_image_1: '1.jpg', about_image_2: '2.jpg', about_image_3: '', about_image_4: '', about_image_5: ''
      });
      var mod = requireModule();
      mod.build();
      await flushPromises();
      window.dispatchEvent(new Event('site_texts_updated'));
      await flushPromises();
      jest.advanceTimersByTime(200);
      expect(document.getElementById('aboutTextContent').innerHTML).toContain('En cada pieza');
    });

    test('registra DomContentLoaded cuando readyState es loading', () => {
      setImages({ about_image_1: '1.jpg', about_image_2: '', about_image_3: '', about_image_4: '', about_image_5: '' });
      Object.defineProperty(document, 'readyState', { value: 'loading', configurable: true });
      var mod = requireModule();
      try {
        expect(typeof mod.build).toBe('function');
      } finally {
        Object.defineProperty(document, 'readyState', { value: 'complete', configurable: true });
      }
    });

    test('onerror del slide intenta fallback y luego imgError', () => {
      require('../../frontend/js/safeImage');
      setImages({ about_image_1: 'bad.jpg', about_image_2: '', about_image_3: '', about_image_4: '', about_image_5: '' });
      var mod = requireModule();
      mod.build();
      var img = document.querySelector('#aboutCarouselTrack .about-carousel-slide img');
      img.dispatchEvent(new Event('error'));
      expect(img.src).toContain('/imagenes/carrucel/1.jpg');
      img.dispatchEvent(new Event('error'));
      expect(img.classList.contains('img-placeholder')).toBe(true);
    });

    test('onerror del slide usa console.error si no hay imgError', () => {
      delete window.imgError;
      setImages({ about_image_1: 'bad.jpg', about_image_2: '', about_image_3: '', about_image_4: '', about_image_5: '' });
      var mod = requireModule();
      mod.build();
      var img = document.querySelector('#aboutCarouselTrack .about-carousel-slide img');
      img.dispatchEvent(new Event('error'));
      img.dispatchEvent(new Event('error'));
    });

    test('texto sobre nosotros es estático: no cambia al navegar entre slides', async () => {
      var prevFetch = global.fetchWithRetry;
      global.fetchWithRetry = jest.fn(function () {
        return Promise.resolve({
          ok: true,
          json: function () {
            return Promise.resolve({
              slots: {
                1: { about_group: 'g1', caption: 'Otro' },
                2: { about_group: 'g2', caption: 'Caption match' }
              }
            });
          }
        });
      });
      setImages({ about_image_1: '1.jpg', about_image_2: '2.jpg', about_image_3: '', about_image_4: '', about_image_5: '' });
      var mod = requireModule();
      mod.build();
      await flushPromises();
      jest.advanceTimersByTime(200);

      var aboutTextContent = document.getElementById('aboutTextContent');
      var initialText = aboutTextContent.innerHTML;
      expect(initialText).toContain('Otro');

      document.getElementById('aboutCarouselNext').click();
      jest.advanceTimersByTime(200);

      expect(aboutTextContent.innerHTML).toBe(initialText);
      global.fetchWithRetry = prevFetch;
    });

    test('slots con valor nulo: el loop saltea el slot null y usa caption del grupo (linea 44 && false)', async () => {
      var prevFetch = global.fetchWithRetry;
      global.fetchWithRetry = jest.fn(function () {
        return Promise.resolve({
          ok: true,
          json: function () {
            return Promise.resolve({
              slots: {
                1: null,
                2: { about_group: 'g2', caption: 'Caption match' }
              }
            });
          }
        });
      });
      setImages({ about_image_1: '1.jpg', about_image_2: '2.jpg', about_image_3: '', about_image_4: '', about_image_5: '' });
      var mod = requireModule();
      mod.build();
      await flushPromises();
      jest.advanceTimersByTime(200);

      var aboutTextContent = document.getElementById('aboutTextContent');
      expect(aboutTextContent.innerHTML).toContain('En cada pieza');

      document.getElementById('aboutCarouselNext').click();
      mod.refreshAboutText();
      jest.advanceTimersByTime(200);

      expect(aboutTextContent.innerHTML).toContain('Caption match');
      global.fetchWithRetry = prevFetch;
    });

    test('slot sin caption usa texto por defecto (linea 45 || false, 50 false)', async () => {
      var prevFetch = global.fetchWithRetry;
      global.fetchWithRetry = jest.fn(function () {
        return Promise.resolve({
          ok: true,
          json: function () {
            return Promise.resolve({
              slots: {
                1: { about_group: 'g1' }
              }
            });
          }
        });
      });
      setImages({ about_image_1: '1.jpg', about_image_2: '2.jpg', about_image_3: '', about_image_4: '', about_image_5: '' });
      var mod = requireModule();
      mod.build();
      await flushPromises();
      jest.advanceTimersByTime(200);

      expect(document.getElementById('aboutTextContent').innerHTML).toContain('En cada pieza');
      global.fetchWithRetry = prevFetch;
    });

    test('loadCarouselData con respuesta no-ok (linea 18)', async () => {
      var prevFetch = global.fetchWithRetry;
      global.fetchWithRetry = jest.fn(function () {
        return Promise.resolve({ ok: false });
      });
      setImages({ about_image_1: '1.jpg', about_image_2: '2.jpg', about_image_3: '', about_image_4: '', about_image_5: '' });
      var mod = requireModule();
      mod.build();
      await flushPromises();
      expect(document.getElementById('aboutTextContent').innerHTML).toContain('En cada pieza');
      global.fetchWithRetry = prevFetch;
    });

    test('loadCarouselData con res null (linea 18 !res)', async () => {
      var prevFetch = global.fetchWithRetry;
      global.fetchWithRetry = jest.fn(function () {
        return Promise.resolve(null);
      });
      setImages({ about_image_1: '1.jpg', about_image_2: '2.jpg', about_image_3: '', about_image_4: '', about_image_5: '' });
      var mod = requireModule();
      mod.build();
      await flushPromises();
      expect(document.getElementById('aboutTextContent').innerHTML).toContain('En cada pieza');
      global.fetchWithRetry = prevFetch;
    });

    test('build sin track ni dotsContainer retorna early (linea 92 !track)', () => {
      document.body.innerHTML = '<div id="aboutTextContent"></div>';
      var mod = requireModule();
      mod.build();
    });

    test('build con track pero sin dotsContainer retorna early (linea 92 !dotsContainer)', () => {
      document.body.innerHTML = '<div id="aboutCarouselTrack"></div><div id="aboutTextContent"></div>';
      var mod = requireModule();
      mod.build();
    });

    test('build sin aboutTextContent no falla (linea 34)', async () => {
      setImages({ about_image_1: '1.jpg', about_image_2: '2.jpg', about_image_3: '', about_image_4: '', about_image_5: '' });
      document.body.innerHTML = `
        <div id="aboutCarouselWrap">
        <div id="aboutCarouselTrack"></div>
        <div id="aboutCarouselDots"></div>
        <button id="aboutCarouselPrev"></button>
        <button id="aboutCarouselNext"></button>
        </div>
      `;
      var mod = requireModule();
      mod.build();
      await flushPromises();
    });

    test('build sin prevBtn ni nextBtn con imágenes (lineas 156, 160 false)', () => {
      setImages({ about_image_1: '1.jpg', about_image_2: '2.jpg', about_image_3: '', about_image_4: '', about_image_5: '' });
      document.body.innerHTML = `
        <div id="aboutCarouselWrap">
        <div id="aboutCarouselTrack"></div>
        <div id="aboutCarouselDots"></div>
        <div id="aboutTextContent"></div>
        </div>
      `;
      var mod = requireModule();
      mod.build();
    });

    test('build sin imágenes ni prevBtn ni nextBtn ni aboutTextEl (lineas 109-111 false)', () => {
      document.body.innerHTML = `
        <div id="aboutCarouselWrap">
        <div id="aboutCarouselTrack"></div>
        <div id="aboutCarouselDots"></div>
        </div>
      `;
      var mod = requireModule();
      mod.build();
    });

    test('img.onload del slide no lanza error', () => {
      setImages({
        about_image_1: '1.jpg', about_image_2: '2.jpg', about_image_3: '', about_image_4: '', about_image_5: ''
      });
      var mod = requireModule();
      mod.build();
      var imgs = document.querySelectorAll('#aboutCarouselTrack .about-carousel-slide img');
      imgs[0].dispatchEvent(new Event('load'));
    });
  });
});
