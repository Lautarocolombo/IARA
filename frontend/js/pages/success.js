/* global normalizeWhatsAppPhone */
(function() {
  initSiteHeader({ showBackButton: true });

  if (typeof initNavbarScroll === 'function') initNavbarScroll();
  if (typeof initMobileNavbar === 'function') initMobileNavbar();

  // Id del pedido para el modal de comprobante (init lo lee antes de limpiar el storage)
  var receiptOrderId = null;

  function init() {
    document.querySelectorAll('.reveal').forEach(el => el.classList.add('visible'));

    const raw = sessionStorage.getItem('ag_last_order');
    const orderInfo = document.getElementById('orderInfo');
    const fallback = document.getElementById('successFallback');

    if (!raw) {
      if (orderInfo) orderInfo.style.display = 'none';
      if (fallback) fallback.style.display = 'block';
      return;
    }

    try {
      const order = JSON.parse(raw);
      sessionStorage.removeItem('ag_last_order');
      receiptOrderId = order.id || null;
      if (order.number) {
        document.getElementById('successOrderNumber').textContent = order.number;
      }
      if (order.total) {
        document.getElementById('successTransferTotal').textContent = formatARS(order.total);
      }
      if (Array.isArray(order.items) && order.items.length) {
        const summaryHtml = order.items.map(i => `
          <div class="summary-item-row">
            <div class="summary-item-meta">
              <span class="summary-item-name">${i.name}</span>
              <span class="summary-item-qty">Cant: ${i.qty}</span>
            </div>
            <div class="summary-item-price">${formatARS(i.price * i.qty)}</div>
          </div>
        `).join('');
        const summaryContainer = document.getElementById('successSummaryItems');
        if (summaryContainer) summaryContainer.innerHTML = summaryHtml;
      }

      const statusBadge = document.getElementById('successStatusBadge');
      if (statusBadge) statusBadge.textContent = 'Esperando Comprobante';

      const trackingBtn = document.getElementById('trackingBtn');
      if (trackingBtn && order.id) {
        trackingBtn.href = `../pages/tracking.html?orderId=${order.id}`;
      }

      const shippingInfo = document.getElementById('successShippingInfo');
      if (shippingInfo) {
        const hasShipping = order.shippingName || order.shippingAddress || order.shippingCity || order.shippingPhone;
        if (hasShipping) {
          const parts = [order.shippingName, order.shippingAddress, order.shippingCity, order.shippingPhone].filter(Boolean);
          shippingInfo.textContent = parts.join(' · ');
          shippingInfo.style.fontStyle = 'normal';
        } else {
          shippingInfo.textContent = 'Serán solicitados por WhatsApp';
          shippingInfo.style.fontStyle = 'italic';
        }
      }

      if (order.waNumber && order.waMsg) {
        const waBtn = document.getElementById('successWhatsappBtn');
        if (waBtn) {
          const waPhone = normalizeWhatsAppPhone(order.waNumber || '');
          waBtn.href = `https://wa.me/${waPhone}?text=${encodeURIComponent(order.waMsg)}`;
        }
      } else {
        const waBtn = document.getElementById('successWhatsappBtn');
        if (waBtn && CONFIG && CONFIG.CONTACT && CONFIG.CONTACT.WHATSAPP) {
          const waMessage = encodeURIComponent('Hola! Quiero confirmar mi pago y enviar mi comprobante de transferencia.');
          const waPhone = normalizeWhatsAppPhone(CONFIG.CONTACT.WHATSAPP);
          waBtn.href = `https://wa.me/${waPhone}?text=${waMessage}`;
        }
      }

      loadSuccessPaymentConfig(order);

      if (orderInfo) orderInfo.style.display = 'block';
      if (fallback) fallback.style.display = 'none';
    } catch (e) {
      console.error('Error leyendo pedido para success:', e);
      if (orderInfo) orderInfo.style.display = 'none';
      if (fallback) fallback.style.display = 'block';
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  async function loadSuccessPaymentConfig(_order) {
    try {
      const res = await window.fetchWithRetry(`${CONFIG.API.BASE}/api/payment-config`, {}, 2, 1000);
      if (!res) return;
      const data = await res.json();
      const alias = data.transferAlias || CONFIG.CONTACT.WHATSAPP_ALIAS || '';
      const holderName = data.holderName || '';
      const message = data.message || '';

      const aliasEl = document.getElementById('successTransferAlias');
      const noteEl = document.getElementById('successTransferNote');
      if (aliasEl) aliasEl.textContent = alias;
      if (noteEl && message) noteEl.textContent = message;

      const holderRow = document.getElementById('successHolderRow');
      const holderEl = document.getElementById('successTransferHolder');
      if (holderRow && holderEl && holderName) {
        holderEl.textContent = holderName;
        holderRow.style.display = '';
      }
    } catch (e) {
      console.error('Error cargando config de pago en success:', e);
    }
  }

  document.addEventListener('click', function(e) {
    if (e.target && e.target.id === 'copySuccessAliasBtn') {
      const alias = document.getElementById('successTransferAlias')?.textContent;
      if (!alias) return;
      e.target.textContent = '✅ Copiado';
      setTimeout(() => { e.target.textContent = '📋 Copiar'; }, 2000);
      navigator.clipboard.writeText(alias).catch(() => {});
    }
  });

  if (typeof initSSESync === 'function') initSSESync();
  startDataSync('success-payment', loadSuccessPaymentConfig);
  onSyncMessage('settings_updated', () => {
    const raw = sessionStorage.getItem('ag_last_order');
    if (raw) {
      try {
        const order = JSON.parse(raw);
        loadSuccessPaymentConfig(order);
      } catch (e) { /* noop */ }
    }
  });

  /* ===== Modal de comprobante (subida pública al pedido) ===== */

  function openReceiptModal() {
    const modal = document.getElementById('receiptModal');
    if (!modal) return;
    const msg = document.getElementById('receiptFormMsg');
    if (msg) msg.textContent = '';
    modal.style.display = 'flex';
  }

  function closeReceiptModal() {
    const modal = document.getElementById('receiptModal');
    if (!modal) return;
    modal.style.display = 'none';
  }

  document.addEventListener('click', function (e) {
    if (e.target && e.target.closest && e.target.closest('#successReceiptBtn')) {
      e.preventDefault();
      openReceiptModal();
      return;
    }
    if (e.target && e.target.closest && e.target.closest('[data-action="close-receipt-modal"]')) {
      closeReceiptModal();
    }
  });

  document.addEventListener('submit', async function (e) {
    if (!e.target || e.target.id !== 'receiptForm') return;
    e.preventDefault();
    const msg = document.getElementById('receiptFormMsg');
    const fileInput = document.getElementById('receiptFile');
    const nameInput = document.getElementById('receiptHolderName');
    const file = fileInput && fileInput.files ? fileInput.files[0] : null;
    if (!receiptOrderId) {
      if (msg) msg.textContent = 'No se encontró el pedido. Volvé al checkout e intentá de nuevo.';
      return;
    }
    if (!file) {
      if (msg) msg.textContent = 'Elegí el archivo del comprobante.';
      return;
    }
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
    if (!allowed.includes(file.type)) {
      if (msg) msg.textContent = 'Formato no permitido. Usá JPG, PNG, WEBP o PDF.';
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      if (msg) msg.textContent = 'El archivo es muy grande (máx. 5 MB).';
      return;
    }
    const submitBtn = e.target.querySelector('[type="submit"]');
    if (submitBtn) submitBtn.disabled = true;
    if (msg) msg.textContent = 'Enviando...';
    try {
      const formData = new FormData();
      formData.append('image', file);
      formData.append('customerName', nameInput ? nameInput.value.trim() : '');
      const res = await fetch(`${CONFIG.API.BASE}/api/v1/orders/${receiptOrderId}/receipt`, {
        method: 'POST',
        body: formData
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'No se pudo subir el comprobante.');
      if (typeof window.showToast === 'function') {
        window.showToast('✅', 'Comprobante enviado correctamente.', 'success');
      }
      e.target.reset();
      closeReceiptModal();
    } catch (err) {
      if (msg) msg.textContent = err.message || 'No se pudo subir el comprobante.';
    } finally {
      if (submitBtn) submitBtn.disabled = false;
    }
  });

})();
