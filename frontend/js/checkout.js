'use strict';

  /* eslint-disable no-unused-vars */

  function updateSummary() {
    const items = getCart();
    const container = document.getElementById('summaryItems');
    const totals = document.getElementById('summaryTotals');
    const hasPendingOrder = !!sessionStorage.getItem('ag_last_order');
    document.getElementById('emptyCart').style.display = items.length || hasPendingOrder ? 'none' : 'block';
    document.getElementById('checkoutContent').style.display = items.length || hasPendingOrder ? 'grid' : 'none';

    container.innerHTML = items.map(it => `
      <div class="item-row">
        <div class="item-thumb">${it.image ? `${window.renderProductImage(it.image, it.name, { placeholder: '📿' })}` : (it.emoji || '📿')}</div>
        <div class="item-meta">
          <h4>${it.name}</h4>
          <p>Cantidad: ${it.qty}</p>
        </div>
        <div class="item-price">${formatARS(it.price * it.qty)}</div>
      </div>
    `).join('');

    const subtotal = items.reduce((s, i) => s + i.price * i.qty, 0);
    const shipping = subtotal > CONFIG.CART.SHIPPING_THRESHOLD ? 0 : CONFIG.CART.SHIPPING_COST;
    const total = subtotal + shipping;

    totals.innerHTML = `
      <div class="summary-row"><span>Subtotal</span><span>${formatARS(subtotal)}</span></div>
      <div class="summary-row"><span>Envío</span><span>${shipping === 0 ? CONFIG.CART.FREE_SHIPPING_TEXT : formatARS(shipping)}</span></div>
      <div class="summary-row total"><span>Total</span><span>${formatARS(total)}</span></div>
    `;

    updateCartBadge();
  }

  async function loadMpAlias() {
     const aliasEl = document.getElementById('mpAliasValue');
     const transferAliasEl = document.getElementById('transferAlias');
     if (aliasEl) aliasEl.textContent = 'Cargando...';
     if (transferAliasEl) transferAliasEl.textContent = 'Cargando...';
     try {
       const url = `${CONFIG.API.BASE}/api/payment-config`;
       const res = await window.fetchWithRetry(url, {}, 2, 1000);
       if (!res) {
         if (aliasEl) aliasEl.textContent = 'No configurado';
         if (transferAliasEl) transferAliasEl.textContent = 'No configurado';
         return { alias: '', whatsapp: (CONFIG.CONTACT.WHATSAPP || '').replace(/[^\d]/g, ''), message: '', active: false };
       }
       const data = await res.json();
       const alias = data.transferAlias || '';
       const cbuCvu = data.cbuCvu || '';
       const holderName = data.holderName || '';
       const whatsapp = (data.whatsapp || CONFIG.CONTACT.WHATSAPP || '').replace(/[^\d]/g, '');
       const message = data.message || 'Transferí el total exacto y enviá el comprobante por WhatsApp para confirmar tu pedido.';
       const active = data.active !== false;
       if (aliasEl) aliasEl.textContent = alias || 'No configurado';
       if (transferAliasEl) transferAliasEl.textContent = alias || 'No configurado';
       if (cbuCvu) {
         const cbuField = document.getElementById('transferCbuCvu');
         const cbuRow = document.getElementById('cbuCvuField');
         if (cbuField) cbuField.textContent = cbuCvu;
         if (cbuRow) cbuRow.style.display = '';
       }
       if (holderName) {
         const holderField = document.getElementById('transferHolder');
         const holderRow = document.getElementById('holderField');
         if (holderField) holderField.textContent = holderName;
         if (holderRow) holderRow.style.display = '';
       }
       return { alias, whatsapp, message, active };
     } catch (err) {
       if (aliasEl) aliasEl.textContent = 'Error al cargar';
       if (transferAliasEl) transferAliasEl.textContent = 'Error al cargar';
       return { alias: 'iara-salgueiro', whatsapp: (CONFIG.CONTACT.WHATSAPP || '').replace(/[^\d]/g, ''), message: '', active: false };
     }
   }

  function copyMpAlias() {
    const alias = document.getElementById('mpAliasValue').textContent;
    if (!alias || alias === 'No configurado' || alias === 'Error al cargar') {
      showToast('', 'Alias no disponible', 'error');
      return;
    }
    navigator.clipboard.writeText(alias).then(() => {
      const btn = document.getElementById('copyAliasBtn');
      btn.textContent = '✓ Copiado';
      setTimeout(() => { btn.textContent = '⟨ Copiar'; }, 2000);
      showToast('', 'Alias copiado', 'success');
    }).catch(() => {
      showToast('', 'No se pudo copiar', 'error');
    });
  }

  function copyTransferField(field) {
    let text = '';
    let btnId = '';
    if (field === 'alias') {
      text = document.getElementById('transferAlias')?.textContent || '';
      btnId = 'copyTransferAliasBtn';
    } else if (field === 'cbuCvu') {
      text = document.getElementById('transferCbuCvu')?.textContent || '';
      btnId = 'copyCbuBtn';
    } else if (field === 'holderName') {
      text = document.getElementById('transferHolder')?.textContent || '';
      btnId = 'copyHolderBtn';
    }
    if (!text || text === 'No configurado' || text === 'Error al cargar') {
      showToast('', 'Dato no disponible', 'error');
      return;
    }
    navigator.clipboard.writeText(text).then(() => {
      const btn = document.getElementById(btnId);
      if (btn) {
        btn.textContent = '✓ Copiado';
        setTimeout(() => { btn.textContent = '⟨ Copiar'; }, 2000);
      }
      showToast('', 'Copiado', 'success');
    }).catch(() => {
      showToast('', 'No se pudo copiar', 'error');
    });
  }

  document.getElementById('shippingForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    const items = getCart();
    if (!items.length) {
      showToast('', 'Carrito vacío', 'error');
      return;
    }

    const fields = {
      name: document.getElementById('shipName'),
      address: document.getElementById('shipAddress'),
      zip: document.getElementById('shipZip'),
      city: document.getElementById('shipCity'),
      phone: document.getElementById('shipPhone'),
      email: document.getElementById('shipEmail')
    };

    const errors = {
      name: '',
      address: '',
      zip: '',
      city: '',
      phone: '',
      email: ''
    };

    const shipping = {
      name: fields.name.value.trim(),
      address: fields.address.value.trim(),
      zip: fields.zip.value.trim(),
      city: fields.city.value.trim(),
      phone: fields.phone.value.trim(),
      email: fields.email.value.trim()
    };

    if (!shipping.name) errors.name = 'Ingresá tu nombre';
    if (!shipping.address) errors.address = 'Ingresá tu dirección';
    if (!shipping.zip) errors.zip = 'Ingresá el código postal';
    if (!shipping.city) errors.city = 'Ingresá tu localidad';
    if (!shipping.phone) errors.phone = 'Ingresá tu teléfono';
    if (!shipping.email) {
      errors.email = 'Ingresá tu email';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(shipping.email)) {
      errors.email = 'Ingresá un email válido';
    }

    const phoneDigits = shipping.phone.replace(/[^\d]/g, '');
    if (shipping.phone && phoneDigits.length < 8) {
      errors.phone = 'Ingresá un teléfono válido';
    }

    const hasErrors = Object.values(errors).some(Boolean);

    Object.keys(fields).forEach(key => {
      const errorEl = document.getElementById(`error-${key}`);
      const group = fields[key].closest('.form-group');
      if (errorEl) errorEl.textContent = errors[key] || '';
      if (group) group.classList.toggle('has-error', !!errors[key]);
    });

    if (hasErrors) {
      const firstError = Object.keys(errors).find(k => errors[k]);
      if (firstError && fields[firstError]) {
        fields[firstError].focus();
      }
      return;
    }

    const subtotal = items.reduce((s, i) => s + i.price * i.qty, 0);
    const shippingCost = subtotal > CONFIG.CART.SHIPPING_THRESHOLD ? 0 : CONFIG.CART.SHIPPING_COST;
    const total = subtotal + shippingCost;

    try {
      const orderRes = await window.fetchWithRetry(`${CONFIG.API.BASE}/api/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: items.map(i => ({ id: i.id, name: i.name, price: i.price, qty: i.qty, emoji: i.emoji, image: i.image })),
          shipping_name: shipping.name,
          shipping_address: shipping.address,
          shipping_phone: shipping.phone,
          shipping_email: shipping.email || '',
          shipping_zip: shipping.zip,
          shipping_city: shipping.city,
          subtotal,
          shipping_cost: shippingCost,
          total
        })
      });

      if (!orderRes) throw new Error('Error al guardar el pedido');
      const orderData = await orderRes.json();
      if (!orderRes.ok) throw new Error(orderData.error || 'Error al guardar el pedido');

      clearCart();

      if (typeof fetchProducts === 'function') {
        await fetchProducts();
      }

      const paymentConfig = await loadMpAlias();
      document.getElementById('paymentTotalAmount').textContent = formatARS(total);

      if (!paymentConfig.active) {
        document.getElementById('paymentInstructions').style.display = 'none';
        document.getElementById('checkoutContent').style.display = 'grid';
        showToast('', 'El pago por transferencia está temporalmente deshabilitado. Contactanos por WhatsApp.', 'error');
        return;
      }

      const waNumber = paymentConfig.whatsapp || (CONFIG.CONTACT.WHATSAPP || '').replace(/[^\d]/g, '');
      const orderId = orderData.id || 'NUEVO';
      const orderNumber = `#${String(orderId).padStart(4, '0')}`;
      const customerName = shipping.name || 'Cliente';
      const waMsg = encodeURIComponent(`Hola! Soy ${customerName}, acabo de hacer el pedido ${orderNumber} por ${formatARS(total)}. Les mando el comprobante de la transferencia.`);

      try {
        await window.fetchWithRetry(`${CONFIG.API.BASE}/api/payments/transfer`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ orderId, amount: total, reference: `web-${Date.now()}` })
        });
      } catch (e) {
        console.warn('[checkout] No se pudo confirmar el pago automáticamente:', e);
      }

      sessionStorage.setItem('ag_last_order', JSON.stringify({
        id: orderId,
        number: orderNumber,
        total: total,
        items: items.map(i => ({ name: i.name, qty: i.qty, price: i.price })),
        waNumber,
        waMsg,
        shippingName: shipping.name,
        shippingEmail: shipping.email
      }));

      document.getElementById('paymentInstructions').style.display = 'block';
      document.getElementById('transferDataCard').style.display = 'block';
      document.getElementById('shippingForm').style.display = 'none';

      document.getElementById('paymentOrderId').textContent = orderNumber;
      document.getElementById('paymentOrderTotal').textContent = formatARS(total);
      document.getElementById('paymentTotalAmount').textContent = formatARS(total);

      document.getElementById('transferOrderNumber').textContent = orderNumber;
      document.getElementById('transferOrderItems').innerHTML = items.map(i => `
        <div class="transfer-item-row">
          <span class="transfer-item-name">${i.name} x${i.qty}</span>
          <span class="transfer-item-price">${formatARS(i.price * i.qty)}</span>
        </div>
      `).join('');
      document.getElementById('transferOrderTotalHighlight').textContent = formatARS(total);

      document.getElementById('whatsappComprobanteBtn').href = `https://wa.me/${waNumber}?text=${waMsg}`;
      document.getElementById('transferReceiptBtn').href = `https://wa.me/${waNumber}?text=${waMsg}`;
      document.getElementById('transferReceiptBtn').dataset.orderNumber = orderNumber;
      document.getElementById('transferReceiptBtn').dataset.orderId = orderId;

      emitSync('order_created');
    } catch (err) {
      showToast('', window.getFetchErrorMessage(err) || 'Error al procesar tu compra. Intentá nuevamente o contactanos.', 'error');
      console.error('Checkout error:', err);
    }
  });

  window.addEventListener('storage', updateSummary);

  function restoreOrderFromSession() {
    const raw = sessionStorage.getItem('ag_last_order');
    if (!raw) return;
    try {
      const order = JSON.parse(raw);
      if (order.number) {
        document.getElementById('paymentOrderId').textContent = order.number;
        document.getElementById('transferOrderNumber').textContent = order.number;
      }
      if (order.total) {
        document.getElementById('paymentOrderTotal').textContent = formatARS(order.total);
        document.getElementById('transferOrderTotalHighlight').textContent = formatARS(order.total);
        document.getElementById('paymentTotalAmount').textContent = formatARS(order.total);
      }
      if (Array.isArray(order.items) && order.items.length) {
        document.getElementById('transferOrderItems').innerHTML = order.items.map(i => `
          <div class="transfer-item-row">
            <span class="transfer-item-name">${i.name} x${i.qty}</span>
            <span class="transfer-item-price">${formatARS(i.price * i.qty)}</span>
          </div>
        `).join('');
      }
      if (order.waNumber && order.waMsg) {
        document.getElementById('whatsappComprobanteBtn').href = `https://wa.me/${order.waNumber}?text=${order.waMsg}`;
        document.getElementById('transferReceiptBtn').href = `https://wa.me/${order.waNumber}?text=${order.waMsg}`;
        document.getElementById('transferReceiptBtn').dataset.orderNumber = order.number;
        document.getElementById('transferReceiptBtn').dataset.orderId = order.id || '';
      }
      window.location.href = 'success.html';
    } catch (e) {
      console.error('Error restaurando pedido desde sesión:', e);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      updateSummary();
      restoreOrderFromSession();
    });
  } else {
    updateSummary();
    restoreOrderFromSession();
  }

  // FASE 2 — Modal para subir comprobante (movido a success.html)
  /*
  function openReceiptModal() {
    const modal = document.getElementById('receiptModal');
    if (!modal) return;
    const btn = document.getElementById('transferReceiptBtn');
    if (btn) {
      document.getElementById('receiptModalOrderNumber').textContent = btn.dataset.orderNumber || '--';
    }
    modal.style.display = 'flex';
  }

  function closeReceiptModal() {
    const modal = document.getElementById('receiptModal');
    if (modal) modal.style.display = 'none';
  }

  const receiptBtn = document.getElementById('transferReceiptBtn');
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
      const btn = document.getElementById('transferReceiptBtn');
      const orderId = btn ? (btn.dataset.orderId || '') : '';
      const orderNumber = btn ? (btn.dataset.orderNumber || '') : '';
      const fileInput = document.getElementById('receiptFile');
      const holderInput = document.getElementById('receiptHolderName');
      if (!orderId || !fileInput.files.length) {
        showToast('', 'Completá todos los campos', 'error');
        return;
      }
      const formData = new FormData();
      formData.append('image', fileInput.files[0]);
      formData.append('holderName', holderInput.value.trim());
      try {
        const res = await window.fetchWithRetry(`${CONFIG.API.BASE}/api/orders/${orderId}/receipt`, {
          method: 'POST',
          body: formData
        });
        if (!res) throw new Error('Error de conexión');
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Error al subir el comprobante');
        showToast('', 'Comprobante enviado correctamente', 'success');
        closeReceiptModal();
        receiptForm.reset();
      } catch (err) {
        showToast('', window.getFetchErrorMessage(err) || 'Error al enviar el comprobante', 'error');
      }
    });
  }
  */

  // Sincronización: refrescar payment-config periódicamente y ante cambios del admin
  startDataSync('payment-config', async () => {
    if (document.getElementById('paymentInstructions') && document.getElementById('paymentInstructions').style.display !== 'none') {
      await loadMpAlias();
    }
  });

  onSyncMessage('settings_updated', async () => {
    await loadMpAlias();
  });