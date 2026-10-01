(function () {
  'use strict';

  function confirmDialog(options) {
    options = options || {};
    return new Promise(function (resolve) {
      var overlay = document.createElement('div');
      overlay.className = 'modal-overlay confirm-dialog-overlay';
      overlay.setAttribute('role', 'presentation');
      var card = document.createElement('section');
      card.className = 'modal-card modal-card--sm confirm-dialog';
      card.setAttribute('role', 'alertdialog');
      card.setAttribute('aria-modal', 'true');
      card.setAttribute('aria-labelledby', 'confirm-title');
      var header = document.createElement('header');
      header.className = 'modal-header';
      var title = document.createElement('h2');
      title.id = 'confirm-title';
      title.className = 'modal-title';
      title.textContent = options.title || 'Confirmar acción';
      var close = document.createElement('button');
      close.type = 'button';
      close.className = 'modal-close';
      close.setAttribute('aria-label', 'Cerrar');
      close.innerHTML = '<span aria-hidden="true">&times;</span>';
      header.appendChild(title);
      header.appendChild(close);
      var body = document.createElement('div');
      body.className = 'modal-body';
      var message = document.createElement('p');
      message.className = 'confirm-dialog__message';
      message.textContent = options.message || '¿Estás seguro?';
      body.appendChild(message);
      var footer = document.createElement('footer');
      footer.className = 'modal-footer';
      var cancel = document.createElement('button');
      cancel.type = 'button';
      cancel.className = options.cancelClassName || 'btn btn-secondary';
      cancel.textContent = options.cancelLabel || 'Cancelar';
      var confirm = document.createElement('button');
      confirm.type = 'button';
      confirm.className = options.confirmClassName || 'btn btn-danger';
      confirm.textContent = options.confirmLabel || 'Confirmar';
      footer.appendChild(cancel);
      footer.appendChild(confirm);
      card.appendChild(header);
      card.appendChild(body);
      card.appendChild(footer);
      overlay.appendChild(card);
      document.body.appendChild(overlay);
      var finish = function (value) {
        overlay.classList.remove('active');
        overlay.style.display = 'none';
        if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
        document.removeEventListener('keydown', onKeydown);
        resolve(value);
      };
      var onKeydown = function (event) {
        if (event.key === 'Escape') finish(false);
      };
      cancel.addEventListener('click', function () { finish(false); });
      confirm.addEventListener('click', function () { finish(true); });
      close.addEventListener('click', function () { finish(false); });
      overlay.addEventListener('mousedown', function (event) { if (event.target === overlay) finish(false); });
      document.addEventListener('keydown', onKeydown);
      window.requestAnimationFrame(function () { confirm.focus(); });
    });
  }

  function ConfirmDialog(options) {
    this.options = options || {};
  }
  ConfirmDialog.ask = confirmDialog;
  ConfirmDialog.prototype.ask = function (overrides) {
    return confirmDialog(Object.assign({}, this.options, overrides || {}));
  };

  window.ConfirmDialog = ConfirmDialog;
  window.confirmDialog = confirmDialog;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { ConfirmDialog, confirmDialog };
  }
}());
