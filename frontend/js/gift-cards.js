(function () {
  'use strict';

  var AMOUNTS = [
    { value: 2000, label: '$2.000', description: 'Un detalle único' },
    { value: 5000, label: '$5.000', description: 'Para elegir con libertad' },
    { value: 10000, label: '$10.000', description: 'Un regalo especial' },
    { value: 20000, label: '$20.000', description: 'Una experiencia para recordar' }
  ];
  var selected = AMOUNTS[0] && AMOUNTS[0].value;

  function renderOptions() {
    var container = document.getElementById('giftOptions');
    if (!container) return;
    container.innerHTML = '';
    AMOUNTS.forEach(function (amount) {
      var button = document.createElement('button');
      button.type = 'button';
      button.className = 'gift-option' + (Number(selected) === amount.value ? ' is-selected' : '');
      button.setAttribute('aria-pressed', Number(selected) === amount.value ? 'true' : 'false');
      var strong = document.createElement('strong');
      strong.textContent = amount.label;
      var span = document.createElement('span');
      span.textContent = amount.description;
      button.appendChild(strong);
      button.appendChild(span);
      button.addEventListener('click', function () {
        selected = amount.value;
        renderOptions();
        updatePreview();
      });
      container.appendChild(button);
    });
  }

  function updatePreview() {
    var preview = document.getElementById('giftAmountPreview');
    if (preview) preview.innerHTML = '<span>Monto seleccionado</span><strong>' + formatARS(selected) + '</strong>';
  }

  function init() {
    renderOptions();
    updatePreview();
    var form = document.getElementById('giftForm');
    if (!form) return;
    form.addEventListener('submit', function (event) {
      event.preventDefault();
      var recipient = document.getElementById('giftRecipient').value.trim();
      var email = document.getElementById('giftEmail').value.trim();
      var message = document.getElementById('giftMessage').value.trim();
      if (!recipient || !email || !message) {
        window.showToast('!', 'Completá los datos del regalo', 'error');
        return;
      }
      var orderMessage = 'Hola! Quiero solicitar una tarjeta de regalo de ' + formatARS(selected) + '.\nDestinatario: ' + recipient + '\nEmail: ' + email + '\nMensaje: ' + message;
      var link = getWhatsAppLink(orderMessage);
      var confirmation = document.getElementById('giftConfirmation');
      if (confirmation) {
        confirmation.hidden = false;
        confirmation.querySelector('#giftConfirmationAmount').textContent = formatARS(selected);
      }
      if (link) window.open(link, '_blank', 'noopener,noreferrer');
      window.showToast('✓', 'Solicitud lista para enviar por WhatsApp', 'success');
    });
  }

  window.initGiftCards = init;
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
}());
