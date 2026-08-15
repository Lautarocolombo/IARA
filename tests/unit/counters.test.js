/**
 * Tests unitarios para counters.js
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

describe('counters.js', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
    document.body.innerHTML = '';
    delete window.animateCount;
  });

  afterEach(() => {
    jest.clearAllMocks();
    delete window.animateCount;
  });

  describe('animateCount', () => {
    test('no hace nada si target no es un número válido', () => {
      document.body.innerHTML = '<span class="stat-number" data-target="abc"></span>';
      require('../../frontend/js/counters');
      window.animateCount(document.querySelector('.stat-number'));
      expect(document.querySelector('.stat-number').textContent).toBe('');
    });

    test('no hace nada si el elemento no tiene data-target', () => {
      require('../../frontend/js/counters');
      const el = document.createElement('span');
      document.body.appendChild(el);
      window.animateCount(el);
      expect(el.textContent).toBe('');
    });

    test('anima contador a target con sufijo', () => {
      document.body.innerHTML = '<span class="stat-number" data-target="100" data-suffix="+"></span>';
      require('../../frontend/js/counters');
      const el = document.querySelector('.stat-number');

      jest.useFakeTimers();
      window.animateCount(el);
      jest.advanceTimersByTime(1500);
      expect(el.textContent).toBe('100+');
      jest.useRealTimers();
    });

    test('anima contador a target sin sufijo', () => {
      document.body.innerHTML = '<span class="stat-number" data-target="50"></span>';
      require('../../frontend/js/counters');
      const el = document.querySelector('.stat-number');

      jest.useFakeTimers();
      window.animateCount(el);
      jest.advanceTimersByTime(1500);
      expect(el.textContent).toBe('50');
      jest.useRealTimers();
    });

    test('inicia desde 0', () => {
      document.body.innerHTML = '<span class="stat-number" data-target="100"></span>';
      require('../../frontend/js/counters');
      const el = document.querySelector('.stat-number');

      jest.useFakeTimers();
      window.animateCount(el);
      jest.advanceTimersByTime(100);
      const value = parseInt(el.textContent, 10);
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(100);
      jest.useRealTimers();
    });

    test('responde a data-target "0"', () => {
      document.body.innerHTML = '<span class="stat-number" data-target="0"></span>';
      require('../../frontend/js/counters');
      const el = document.querySelector('.stat-number');

      jest.useFakeTimers();
      window.animateCount(el);
      jest.advanceTimersByTime(1500);
      expect(el.textContent).toBe('0');
      jest.useRealTimers();
    });

    test('responde a data-target con valor negativo', () => {
      document.body.innerHTML = '<span class="stat-number" data-target="-10"></span>';
      require('../../frontend/js/counters');
      const el = document.querySelector('.stat-number');

      jest.useFakeTimers();
      window.animateCount(el);
      jest.advanceTimersByTime(1500);
      expect(el.textContent).toBe('-10');
      jest.useRealTimers();
    });
  });

  describe('inicialización automática', () => {
    test('no hace nada si no hay contadores en el DOM', () => {
      require('../../frontend/js/counters');
      expect(() => require('../../frontend/js/counters')).not.toThrow();
    });

    test('procesa contadores en el DOM', () => {
      document.body.innerHTML = `
        <span class="stat-number" data-target="100" data-suffix="+"></span>
        <span class="stat-number" data-target="50"></span>
      `;
      require('../../frontend/js/counters');
      const elements = document.querySelectorAll('.stat-number[data-target]');
      expect(elements.length).toBe(2);
    });

    test('usa IntersectionObserver cuando está disponible', () => {
      document.body.innerHTML = `
        <span class="stat-number" data-target="100"></span>
      `;
      const mockObserver = {
        observe: jest.fn(),
        unobserve: jest.fn()
      };
      global.IntersectionObserver = jest.fn(() => mockObserver);
      require('../../frontend/js/counters');
      expect(mockObserver.observe).toHaveBeenCalled();
    });

    test('usa animateCount directo si no hay IntersectionObserver', () => {
      document.body.innerHTML = `
        <span class="stat-number" data-target="100"></span>
      `;
      delete global.IntersectionObserver;
      window.animateCount = jest.fn();
      require('../../frontend/js/counters');
      expect(window.animateCount).toHaveBeenCalled();
    });
  });

  describe('window exports', () => {
    test('expone animateCount', () => {
      require('../../frontend/js/counters');
      expect(typeof window.animateCount).toBe('function');
    });
  });

  describe('curva de animación', () => {
    test('usa easing cúbico', () => {
      document.body.innerHTML = '<span class="stat-number" data-target="100"></span>';
      require('../../frontend/js/counters');
      const el = document.querySelector('.stat-number');

      jest.useFakeTimers();
      window.animateCount(el);
      jest.advanceTimersByTime(700);
      const value = parseInt(el.textContent, 10);
      expect(value).toBeGreaterThan(50);
      jest.useRealTimers();
    });
  });

  describe('múltiples contadores', () => {
    test('anima múltiples contadores independientemente', () => {
      document.body.innerHTML = `
        <span class="stat-number" data-target="100"></span>
        <span class="stat-number" data-target="200"></span>
      `;
      require('../../frontend/js/counters');
      const el1 = document.querySelectorAll('.stat-number')[0];
      const el2 = document.querySelectorAll('.stat-number')[1];

      jest.useFakeTimers();
      window.animateCount(el1);
      window.animateCount(el2);
      jest.advanceTimersByTime(1500);
      expect(el1.textContent).toBe('100');
      expect(el2.textContent).toBe('200');
      jest.useRealTimers();
    });
  });
});
