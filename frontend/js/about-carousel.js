(function () {
  'use strict';

  var AUTOPLAY_INTERVAL = 4500;

  var slides = [];
  var dots = [];
  var currentIndex = 0;
  var autoplayTimer = null;
  var isPaused = false;
  var aboutTexts = [];
  var aboutTextEl = null;

  var ABOUT_GROUPS = [
    { indices: [0, 1], text: 'En cada pieza dejamos un pedacito de Gualeguay: horas de trabajo manual, materiales elegidos con cuidado y el orgullo de hacer las cosas bien.' },
    { indices: [2, 3], text: 'Artesanía Gualeguay nació en el corazón de Entre Ríos con la misión de crear pulseras, souvenirs y accesorios únicos que capturen la esencia de nuestra tierra.' },
    { indices: [4], text: '' }
  ];

  function collectImages(srcMap) {
    var images = [];
    srcMap = srcMap || {};
    for (var i = 1; i <= 5; i++) {
      var url = srcMap['about_image_' + i];
      if (url) images.push(url);
    }
    return images;
  }

  function getTextForIndex(index) {
    for (var i = 0; i < ABOUT_GROUPS.length; i++) {
      var group = ABOUT_GROUPS[i];
      if (group.indices.indexOf(index) !== -1) {
        return group.text;
      }
    }
    return '';
  }

  function updateAboutText(index) {
    if (!aboutTextEl) return;
    var text = getTextForIndex(index);
    aboutTextEl.style.opacity = '0';
    setTimeout(function () {
      aboutTextEl.textContent = text;
      aboutTextEl.style.opacity = '1';
    }, 200);
  }

  function wrapIndex(index, length) {
    if (length <= 0) return 0;
    if (index < 0) return length - 1;
    if (index >= length) return 0;
    return index;
  }

  function build() {
    var track = document.getElementById('aboutCarouselTrack');
    var dotsContainer = document.getElementById('aboutCarouselDots');
    var prevBtn = document.getElementById('aboutCarouselPrev');
    var nextBtn = document.getElementById('aboutCarouselNext');
    var wrap = document.getElementById('aboutCarouselWrap');

    aboutTextEl = document.getElementById('aboutTextContent');

    if (!track || !dotsContainer) return;

    if (autoplayTimer) { clearInterval(autoplayTimer); autoplayTimer = null; }
    track.innerHTML = '';
    dotsContainer.innerHTML = '';
    slides = [];
    dots = [];
    currentIndex = 0;
    isPaused = false;

    var images = collectImages(window.__aboutImages);

    if (!images.length) {
      wrap.style.display = '';
      wrap.classList.add('visible');
      track.innerHTML = '<div class="about-carousel-slide active" style="display:flex;align-items:center;justify-content:center;padding:2rem;"><p style="color:var(--text-muted);text-align:center;">Próximamente nuevas imágenes</p></div>';
      if (dotsContainer) dotsContainer.innerHTML = '';
      if (prevBtn) prevBtn.style.display = 'none';
      if (nextBtn) nextBtn.style.display = 'none';
      if (aboutTextEl) aboutTextEl.textContent = '';
      return;
    }

    wrap.style.display = '';
    wrap.classList.add('visible');

    images.forEach(function (src, idx) {
      var slide = document.createElement('div');
      slide.className = 'about-carousel-slide' + (idx === 0 ? ' active' : '');
      var img = document.createElement('img');
      img.src = src;
      img.alt = 'Sobre Nosotros ' + (idx + 1);
      img.loading = idx === 0 ? 'eager' : 'lazy';
      img.dataset.fallback = '/imagenes/carrucel/' + (idx + 1) + '.jpg';
      img.onerror = function() {
        var fb = img.dataset.fallback;
        if (fb && img.src.indexOf(fb) === -1) {
          console.warn('[about-carousel] Primary image failed, trying fallback:', fb);
          img.src = fb;
          return;
        }
        console.error('[about-carousel] Error cargando imagen:', src);
        if (typeof window.imgError === 'function') {
          window.imgError(img, '📷');
        } else {
          console.error('[about-carousel] Error cargando imagen:', src);
        }
      };
      img.onload = function() {
      };
      slide.appendChild(img);
      track.appendChild(slide);
      slides.push(slide);

      var dot = document.createElement('button');
      dot.className = 'about-carousel-dot' + (idx === 0 ? ' active' : '');
      dot.setAttribute('aria-label', 'Imagen ' + (idx + 1));
      dot.addEventListener('click', (function (index) {
        return function () { goTo(index); resetAutoplay(); };
      })(idx));
      dotsContainer.appendChild(dot);
      dots.push(dot);
    });

    if (prevBtn) {
      prevBtn.style.display = '';
      prevBtn.onclick = function () { goTo(currentIndex - 1); resetAutoplay(); };
    }
    if (nextBtn) {
      nextBtn.style.display = '';
      nextBtn.onclick = function () { goTo(currentIndex + 1); resetAutoplay(); };
    }

    wrap.onmouseenter = pauseAutoplay;
    wrap.onmouseleave = resumeAutoplay;
    wrap.ontouchstart = pauseAutoplay;
    wrap.ontouchend = resumeAutoplay;

    updateAboutText(0);

    startAutoplay();
  }

  function goTo(index) {
    if (!slides.length) return;
    index = wrapIndex(index, slides.length);

    slides[currentIndex].classList.remove('active');
    dots[currentIndex].classList.remove('active');

    currentIndex = index;

    slides[currentIndex].classList.add('active');
    dots[currentIndex].classList.add('active');
    updateAboutText(currentIndex);
  }

  function startAutoplay() {
    stopAutoplay();
    autoplayTimer = setInterval(function () {
      if (!isPaused) goTo(currentIndex + 1);
    }, AUTOPLAY_INTERVAL);
  }

  function stopAutoplay() {
    if (autoplayTimer) { clearInterval(autoplayTimer); autoplayTimer = null; }
  }

  function resetAutoplay() {
    stopAutoplay();
    startAutoplay();
  }

  function pauseAutoplay() { isPaused = true; }
  function resumeAutoplay() { isPaused = false; }

  window.initAboutCarousel = build;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
      collectImages: collectImages,
      wrapIndex: wrapIndex,
      build: build
    };
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', build);
  } else {
    build();
  }
})();
