(function() {
  initSiteHeader({ showBackButton: true });

  if (typeof initNavbarScroll === 'function') initNavbarScroll();
  if (typeof initMobileNavbar === 'function') initMobileNavbar();

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
      try { localStorage.removeItem('ag_pending_order'); } catch (e) { /* noop */ }
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
        if (waBtn) waBtn.href = `https://wa.me/${order.waNumber}?text=${order.waMsg}`;
      } else {
        const waBtn = document.getElementById('successWhatsappBtn');
        if (waBtn && CONFIG && CONFIG.CONTACT && CONFIG.CONTACT.WHATSAPP) {
          const waMessage = encodeURIComponent('Hola! Quiero confirmar mi pago y enviar mi comprobante de transferencia.');
          waBtn.href = `https://wa.me/${CONFIG.CONTACT.WHATSAPP.replace(/[^\d]/g, '')}?text=${waMessage}`;
        }
      }

      const receiptBtn = document.getElementById('successReceiptBtn');
      if (receiptBtn) {
        receiptBtn.dataset.orderId = order.id || '';
        receiptBtn.dataset.orderNumber = order.number || '';
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

  function openReceiptModal() {
    const modal = document.getElementById('receiptModal');
    if (!modal) return;
    const btn = document.getElementById('successReceiptBtn');
    if (btn) {
      document.getElementById('receiptModalOrderNumber').textContent = btn.dataset.orderNumber || '--';
    }
    modal.style.display = 'flex';
    openModalScrollLock(modal, closeReceiptModal);
  }

  function closeReceiptModal() {
    const modal = document.getElementById('receiptModal');
    if (modal) modal.style.display = 'none';
    unlockModalScroll();
  }

  const receiptBtn = document.getElementById('successReceiptBtn');
  if (receiptBtn) {
    receiptBtn.addEventListener('click', (e) => {
      e.preventDefault();
      openReceiptModal();
    });
  }

  const receiptForm = document.getElementById('receiptForm');
  if (receiptForm) {
    receiptForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = document.getElementById('successReceiptBtn');
      const orderId = btn ? (btn.dataset.orderId || '') : '';
      const fileInput = document.getElementById('receiptFile');
      const holderInput = document.getElementById('receiptHolderName');
      if (!orderId || !fileInput.files.length) {
        showToast('', 'Completá todos los campos', 'error');
        return;
      }
      const formData = new FormData();
      formData.append('customerName', holderInput.value.trim());
      formData.append('image', fileInput.files[0]);
      const orderToken = (() => {
        const rawSession = sessionStorage.getItem('ag_last_order');
        const rawLocal = localStorage.getItem('ag_pending_order');
        const raw = rawLocal || rawSession;
        if (!raw) return '';
        try {
          const order = JSON.parse(raw);
          return order.orderToken || '';
        } catch {
          return '';
        }
      })();
      try {
        const res = await window.fetchWithRetry(`${CONFIG.API.BASE}/api/payments/proofs/${orderId}`, {
          method: 'POST',
          headers: { 'X-Order-Token': orderToken || '' },
          body: formData
        });
        if (!res) throw new Error('Error de conexión');
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Error al subir el comprobante');
        showToast('', 'Comprobante enviado correctamente. Te avisaremos cuando sea verificado.', 'success');
        closeReceiptModal();
        receiptForm.reset();
        try { localStorage.removeItem('ag_pending_order'); } catch (e) { /* noop */ }
        try { sessionStorage.removeItem('ag_last_order'); } catch (e) { /* noop */ }
      } catch (err) {
        showToast('', window.getFetchErrorMessage(err) || 'Error al enviar el comprobante', 'error');
      }
    });
  }

  document.addEventListener('click', function(e) {
    if (e.target && e.target.id === 'copySuccessAliasBtn') {
      const alias = document.getElementById('successTransferAlias')?.textContent;
      if (!alias) return;
      e.target.textContent = '✅ Copiado';
      setTimeout(() => { e.target.textContent = '📋 Copiar'; }, 2000);
      navigator.clipboard.writeText(alias).catch(() => {});
    }
    if (e.target && e.target.matches('[data-action="close-receipt-modal"]')) {
      closeReceiptModal();
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
})();
