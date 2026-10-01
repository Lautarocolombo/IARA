(function () {
  'use strict';

  var activeModal = null;
  var lastFocusedElement = null;

  function escapeHtml(value) {
    if (value === null || value === undefined) return '';
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function getElement(target) {
    if (!target) return null;
    if (typeof target === 'string') return document.querySelector(target);
    return target;
  }

  function createOverlay(options) {
    var overlay = document.createElement('div');
    overlay.className = 'modal-overlay' + (options.className ? ' ' + options.className : '');
    overlay.setAttribute('role', 'presentation');

    var card = document.createElement('section');
    card.className = 'modal-card' + (options.size ? ' modal-card--' + options.size : '');
    card.setAttribute('role', options.role || 'dialog');
    card.setAttribute('aria-modal', 'true');
    card.setAttribute('aria-labelledby', 'modal-title');

    var header = document.createElement('header');
    header.className = 'modal-header';
    var title = document.createElement('h2');
    title.id = 'modal-title';
    title.className = 'modal-title';
    title.textContent = options.title || '';
    var closeButton = document.createElement('button');
    closeButton.type = 'button';
    closeButton.className = 'modal-close';
    closeButton.setAttribute('aria-label', 'Cerrar');
    closeButton.innerHTML = '<span aria-hidden="true">&times;</span>';
    closeButton.addEventListener('click', function () { closeModal(overlay); });
    header.appendChild(title);
    header.appendChild(closeButton);

    var body = document.createElement('div');
    body.className = 'modal-body';
    if (typeof options.content === 'string') {
      body.innerHTML = options.content;
    } else if (options.content instanceof Node) {
      body.appendChild(options.content);
    }

    var footer = null;
    if (Array.isArray(options.actions) && options.actions.length) {
      footer = document.createElement('footer');
      footer.className = 'modal-footer';
      options.actions.forEach(function (action) {
        var button = document.createElement('button');
        button.type = 'button';
        button.className = action.className || 'btn btn-secondary';
        button.textContent = action.label || 'Aceptar';
        button.addEventListener('click', function () {
          if (action.onClick) action.onClick(overlay);
          if (action.close !== false) closeModal(overlay);
        });
        footer.appendChild(button);
      });
    }

    card.appendChild(header);
    card.appendChild(body);
    if (footer) card.appendChild(footer);
    overlay.appendChild(card);
    overlay.addEventListener('mousedown', function (event) {
      if (options.closeOnBackdrop !== false && event.target === overlay) closeModal(overlay);
    });
    return overlay;
  }

  function handleKeydown(event) {
    if (!activeModal) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      closeModal(activeModal);
      return;
    }
    if (event.key !== 'Tab') return;
    var focusable = Array.from(activeModal.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'))
      .filter(function (element) { return !element.disabled && element.offsetParent !== null; });
    if (!focusable.length) return;
    var first = focusable[0];
    var last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  function openModal(options) {
    if (!document) return null;
    options = options || {};
    if (activeModal) closeModal(activeModal, { restoreFocus: false });
    var overlay = options.overlay instanceof Node ? options.overlay : createOverlay(options);
    if (!overlay.parentNode) document.body.appendChild(overlay);
    overlay.classList.add('active');
    overlay.style.display = '';
    activeModal = overlay;
    lastFocusedElement = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    document.body.classList.add('modal-open');
    document.addEventListener('keydown', handleKeydown);
    var closeButton = overlay.querySelector('.modal-close');
    if (closeButton) closeButton.focus();
    if (options.onOpen) options.onOpen(overlay);
    return overlay;
  }

  function closeModal(overlay, options) {
    var target = overlay instanceof Node ? overlay : activeModal;
    if (!target) return false;
    options = options || {};
    target.classList.remove('active');
    target.style.display = 'none';
    if (target === activeModal) {
      activeModal = null;
      document.removeEventListener('keydown', handleKeydown);
      document.body.classList.remove('modal-open');
      if (options.restoreFocus !== false && lastFocusedElement && typeof lastFocusedElement.focus === 'function') {
        lastFocusedElement.focus();
      }
      lastFocusedElement = null;
    }
    if (options.keepInDom === false && target.parentNode) target.parentNode.removeChild(target);
    if (typeof target._onClose === 'function') target._onClose();
    return true;
  }

  function initModal() {
    document.addEventListener('click', function (event) {
      var trigger = event.target.closest('[data-modal-open]');
      if (!trigger) return;
      var target = getElement(trigger.getAttribute('data-modal-target'));
      if (!target) return;
      target._onClose = function () {
        if (trigger.getAttribute('data-modal-return-focus') !== 'false' && typeof trigger.focus === 'function') trigger.focus();
      };
      openModal({ overlay: target, title: trigger.getAttribute('data-modal-title') || '' });
    });
  }

  function Modal(options) {
    this.options = options || {};
  }
  Modal.prototype.open = function () { return openModal(this.options); };
  Modal.prototype.close = function (options) { return closeModal(this.options.overlay, options); };

  window.Modal = Modal;
  window.openModal = openModal;
  window.closeModal = closeModal;
  window.initModal = initModal;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { Modal, openModal, closeModal, initModal, escapeHtml };
  }

  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initModal);
    else initModal();
  }
}());
