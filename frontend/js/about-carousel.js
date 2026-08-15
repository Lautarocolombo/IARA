(function () {
  'use strict';

  var AUTOPLAY_INTERVAL = 4500;

  var slides = [];
  var dots = [];
  var currentIndex = 0;
  var autoplayTimer = null;
  var isPaused = false;

  function collectImages(srcMap) {
    var images = [];
    srcMap = srcMap || {};
    for (var i = 1; i <= 5; i++) {
      var url = srcMap['about_image_' + i];
      if (url) images.push(url);
    }
    return images;
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
      track.innerHTML = '<div class="about-carousel-slide active" style="display:flex;align-items:center;justify-content:center;padding:2rem;"><p style="color:var(--text-muted);text-align:center;">Próximamente nuevas imágenes</p></div>';
      if (dotsContainer) dotsContainer.innerHTML = '';
      if (prevBtn) prevBtn.style.display = 'none';
      if (nextBtn) nextBtn.style.display = 'none';
      return;
    }

    wrap.style.display = '';

    images.forEach(function (src, idx) {
      var slide = document.createElement('div');
      slide.className = 'about-carousel-slide' + (idx === 0 ? ' active' : '');
      var img = document.createElement('img');
      img.src = src;
      img.alt = 'Sobre Nosotros ' + (idx + 1);
      img.loading = idx === 0 ? 'eager' : 'lazy';
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
