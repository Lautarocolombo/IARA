'use strict';

(function() {
  function animateCount(el) {
    const target = parseInt(el.getAttribute('data-target'), 10);
    if (isNaN(target)) return;
    const suffix = el.getAttribute('data-suffix') || '';
    const duration = 1400;
    const start = performance.now();

    function tick(now) {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = Math.floor(eased * target);
      el.textContent = current + suffix;
      if (progress < 1) {
        requestAnimationFrame(tick);
      } else {
        el.textContent = target + suffix;
      }
    }

    requestAnimationFrame(tick);
  }

  window.animateCount = window.animateCount || animateCount;

  const counters = document.querySelectorAll('.stat-number[data-target]');
  if (!counters.length) return;

  let animated = new Set();

  function safeAnimate(el) {
    if (!el || animated.has(el)) return;
    animated.add(el);
    try {
      window.animateCount(el);
    } catch (err) {
      console.error('[Counters] Error animating counter:', err);
      const target = parseInt(el.getAttribute('data-target'), 10);
      const suffix = el.getAttribute('data-suffix') || '';
      if (!isNaN(target)) {
        el.textContent = target + suffix;
      }
    }
  }

  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          safeAnimate(entry.target);
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.1, rootMargin: '0px 0px -50px 0px' });

    counters.forEach(el => {
      observer.observe(el);
      if (el.getBoundingClientRect().top < window.innerHeight && el.getBoundingClientRect().bottom > 0) {
        safeAnimate(el);
        observer.unobserve(el);
      }
    });

    setTimeout(() => {
      counters.forEach(el => {
        if (!animated.has(el)) {
          safeAnimate(el);
        }
      });
    }, 3000);
  } else {
    counters.forEach(el => safeAnimate(el));
  }
})();
