'use strict';

/* global SharedPayment, escapeHtml */

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
        <div class="item-thumb">${it.image ? `<img src="${escapeHtml(it.image)}" alt="" style="width:48px;height:48px;object-fit:cover;border-radius:6px;" />` : (it.emoji || '📿')}</div>
        <div class="item-info">
          <div class="item-name">${escapeHtml(it.name)}</div>
          <div class="item-qty">Cantidad: ${it.qty}</div>
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
        const data = await SharedPayment.loadPaymentConfig();
        if (!data) {
          if (aliasEl) aliasEl.textContent = 'No configurado';
          if (transferAliasEl) transferAliasEl.textContent = 'No configurado';
         return { alias: CONFIG.CONTACT.WHATSAPP_ALIAS || '', whatsapp: (CONFIG.CONTACT.WHATSAPP || '').replace(/[^\d]/g, ''), message: '', active: false, mpEnabled: false };
        }
        const alias = SharedPayment.getTransferAlias(data);
        const cbuCvu = data.cbuCvu || '';
        const holderName = data.holderName || '';
        const whatsapp = SharedPayment.getWhatsAppNumber(data);
        const message = SharedPayment.getTransferMessage(data);
        const active = data.active !== false;
        const mpEnabled = data.mpEnabled === true;
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
         const mpOption = document.getElementById('mpPaymentOption');
         if (mpOption) {
           mpOption.style.display = mpEnabled ? 'flex' : 'none';
           if (!mpEnabled) {
             const transferRadio = document.querySelector('input[name="paymentMethod"][value="transfer"]');
             if (transferRadio) transferRadio.checked = true;
           }
         }
         document.querySelectorAll('.payment-method-option').forEach(opt => {
           opt.classList.toggle('selected', opt.querySelector('input[type="radio"]')?.checked);
         });
         return { alias, whatsapp, message, active, mpEnabled };
       } catch (err) {
       if (aliasEl) aliasEl.textContent = 'Error al cargar';
       if (transferAliasEl) transferAliasEl.textContent = 'Error al cargar';
        return { alias: CONFIG.CONTACT.WHATSAPP_ALIAS || '', whatsapp: (CONFIG.CONTACT.WHATSAPP || '').replace(/[^\d]/g, ''), message: '', active: false, mpEnabled: false };
     }
   }

  function copyMpAlias() {
    const alias = document.getElementById('mpAliasValue').textContent;
    SharedPayment.copyText(alias, document.getElementById('copyAliasBtn'));
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
    SharedPayment.copyText(text, document.getElementById(btnId));
  }

  document.getElementById('shippingForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    const items = getCart();
    if (!items.length) {
      showToast('', 'Carrito vacío', 'error');
      return;
    }

    const fields = checkoutFields;
    const errors = checkoutErrors;

    const shipping = {
      name: fields.name.value.trim(),
      address: fields.address.value.trim(),
      zip: fields.zip.value.trim(),
      city: fields.city.value.trim(),
      province: fields.province.value.trim(),
      phone: fields.phone.value.trim(),
      email: fields.email.value.trim()
    };

    errors.name = validateField('name', shipping.name);
    errors.address = validateField('address', shipping.address);
    errors.zip = validateField('zip', shipping.zip);
    errors.city = validateField('city', shipping.city);
    errors.province = validateField('province', shipping.province);
    errors.phone = validateField('phone', shipping.phone);
    errors.email = validateField('email', shipping.email);

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

    const paymentMethod = (document.querySelector('input[name="paymentMethod"]:checked')?.value) || 'transfer';

    const submitBtn = document.getElementById('checkoutSubmitBtn');
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = 'Procesando...';
    }

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
          shipping_province: shipping.province,
          total,
          payment_method: paymentMethod
        })
      });

      if (!orderRes) throw new Error('Error al guardar el pedido');
      const orderData = await orderRes.json();
      if (!orderRes.ok) throw new Error(orderData.error || 'Error al guardar el pedido');

      clearCart().catch(() => {});

      if (typeof fetchProducts === 'function') {
        await fetchProducts();
      }

      const paymentConfig = await loadMpAlias();
      const serverShippingCost = orderData.shippingCost || shippingCost;
      const serverTotal = orderData.total || total;
      const selectedPaymentMethod = orderData.paymentMethod || paymentMethod;
      document.getElementById('paymentTotalAmount').textContent = formatARS(serverTotal);

      if (!paymentConfig.active && selectedPaymentMethod === 'transfer') {
        document.getElementById('paymentInstructions').style.display = 'none';
        document.getElementById('checkoutContent').style.display = 'grid';
        showToast('', 'El pago está temporalmente deshabilitado. Contactanos por WhatsApp.', 'error');
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = 'Continuar al pago';
        }
        return;
      }

      const waNumber = paymentConfig.whatsapp || (CONFIG.CONTACT.WHATSAPP || '').replace(/[^\d]/g, '');
      const orderId = orderData.id || 'NUEVO';
      const orderNumber = `#${String(orderId).padStart(4, '0')}`;
      const customerName = shipping.name || 'Cliente';
      const productList = items.map(i => `- ${escapeHtml(i.name)} x${i.qty} = ${formatARS(i.price * i.qty)}`).join('\n');
      const waMsg = orderData.waMessage || encodeURIComponent(`Hola! Soy ${customerName}, acabo de hacer el pedido ${orderNumber}:\n${productList}\nTotal: ${formatARS(serverTotal)}\nLes mando el comprobante de la transferencia.`);

      sessionStorage.setItem('ag_last_order', JSON.stringify({
        id: orderId,
        number: orderNumber,
        total: serverTotal,
        items: items.map(i => ({ name: i.name, qty: i.qty, price: i.price })),
        waNumber,
        waMsg,
        shippingName: shipping.name,
        shippingEmail: shipping.email,
        shippingProvince: shipping.province,
        shippingCity: shipping.city,
        shippingZip: shipping.zip,
        shippingAddress: shipping.address,
        shippingCost: serverShippingCost,
        paymentMethod: selectedPaymentMethod,
        reservedUntil: orderData.reservedUntil || null
      }));

      document.getElementById('paymentOrderId').textContent = orderNumber;
      document.getElementById('paymentOrderTotal').textContent = formatARS(serverTotal);
      document.getElementById('paymentTotalAmount').textContent = formatARS(serverTotal);

      document.getElementById('transferOrderNumber').textContent = orderNumber;
      document.getElementById('transferOrderItems').innerHTML = items.map(i => `
        <div class="transfer-item-row">
          <span class="transfer-item-name">${i.name} x${i.qty}</span>
          <span class="transfer-item-price">${formatARS(i.price * i.qty)}</span>
        </div>
      `).join('');
      document.getElementById('transferOrderTotalHighlight').textContent = formatARS(serverTotal);

      document.getElementById('whatsappComprobanteBtn').href = `https://wa.me/${waNumber}?text=${waMsg}`;
      document.getElementById('transferReceiptBtn').href = `https://wa.me/${waNumber}?text=${waMsg}`;
      document.getElementById('transferReceiptBtn').dataset.orderNumber = orderNumber;
      document.getElementById('transferReceiptBtn').dataset.orderId = orderId;

      if (selectedPaymentMethod === 'transfer') {
        document.getElementById('paymentInstructions').style.display = 'block';
        document.getElementById('transferDataCard').style.display = 'block';
        document.getElementById('shippingForm').style.display = 'none';

        if (orderData.reservedUntil) {
          const expiresAt = new Date(orderData.reservedUntil);
          const now = new Date();
          const minutesLeft = Math.max(0, Math.round((expiresAt - now) / 60000));
          const countdownEl = document.getElementById('transferCountdown');
          if (countdownEl) {
            countdownEl.textContent = `Tu reserva vence en ${minutesLeft} minutos`;
            countdownEl.style.display = 'block';
          }
        }
      } else {
        document.getElementById('paymentInstructions').style.display = 'none';
        document.getElementById('transferDataCard').style.display = 'none';
        document.getElementById('shippingForm').style.display = 'none';
        showToast('', 'Método de pago no disponible actualmente. Te contactamos por WhatsApp.', 'error');
      }

      emitSync('order_created');
     } catch (err) {
      showToast('', window.getFetchErrorMessage(err) || 'Error al procesar tu compra. Intentá nuevamente o contactanos.', 'error');
      console.error('Checkout error:', err);
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Continuar al pago';
      }
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

      if (order.paymentMethod === 'transfer') {
        document.getElementById('paymentInstructions').style.display = 'block';
        document.getElementById('transferDataCard').style.display = 'block';
        document.getElementById('shippingForm').style.display = 'none';

        if (order.reservedUntil) {
          const expiresAt = new Date(order.reservedUntil);
          const now = new Date();
          const minutesLeft = Math.max(0, Math.round((expiresAt - now) / 60000));
          const countdownEl = document.getElementById('transferCountdown');
          if (countdownEl) {
            countdownEl.textContent = `Tu reserva vence en ${minutesLeft} minutos`;
            countdownEl.style.display = 'block';
          }
        }
      }
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

  // Sincronización: refrescar payment-config periódicamente y ante cambios del admin
  startDataSync('payment-config', async () => {
    await loadMpAlias();
  });

  onSyncMessage('settings_updated', async () => {
    await loadMpAlias();
  });

  const checkoutFields = {
    name: document.getElementById('shipName'),
    address: document.getElementById('shipAddress'),
    zip: document.getElementById('shipZip'),
    city: document.getElementById('shipCity'),
    province: document.getElementById('shipProvince'),
    phone: document.getElementById('shipPhone'),
    email: document.getElementById('shipEmail')
  };

  const checkoutErrors = {
    name: '',
    address: '',
    zip: '',
    city: '',
    province: '',
    phone: '',
    email: ''
  };

  ['province', 'zip'].forEach(key => {
    const field = checkoutFields[key];
    if (!field) return;
    field.addEventListener('blur', refreshShippingEstimate);
    field.addEventListener('change', refreshShippingEstimate);
  });

  document.querySelectorAll('.payment-method-option input[type="radio"]').forEach(radio => {
    radio.addEventListener('change', () => {
      document.querySelectorAll('.payment-method-option').forEach(opt => {
        opt.classList.toggle('selected', opt.querySelector('input[type="radio"]')?.checked);
      });
    });
  });

  function validateField(key, value) {
    if (key === 'name' && !value.trim()) return 'Ingresá tu nombre';
    if (key === 'address' && !value.trim()) return 'Ingresá tu dirección';
    if (key === 'zip' && !value.trim()) return 'Ingresá el código postal';
    if (key === 'city' && !value.trim()) return 'Ingresá tu localidad';
    if (key === 'province' && !value.trim()) return 'Ingresá tu provincia';
    if (key === 'phone') {
      const digits = value.replace(/[^\d]/g, '');
      if (!value.trim()) return 'Ingresá tu teléfono';
      if (digits.length < 8) return 'Ingresá un teléfono válido';
    }
    if (key === 'email') {
      if (!value.trim()) return 'Ingresá tu email';
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())) return 'Ingresá un email válido';
    }
    return '';
  }

  function showFieldError(key, msg) {
    checkoutErrors[key] = msg;
    const errorEl = document.getElementById(`error-${key}`);
    const group = checkoutFields[key]?.closest('.form-group');
    if (errorEl) errorEl.textContent = msg;
    if (group) group.classList.add('has-error');
  }

  function clearFieldError(key) {
    checkoutErrors[key] = '';
    const errorEl = document.getElementById(`error-${key}`);
    const group = checkoutFields[key]?.closest('.form-group');
    if (errorEl) errorEl.textContent = '';
    if (group) group.classList.remove('has-error');
  }

  async function refreshShippingEstimate() {
    const province = checkoutFields.province.value.trim();
    const zip = checkoutFields.zip.value.trim();
    const subtotal = getCart().reduce((s, i) => s + i.price * i.qty, 0);
    if (!province || !zip || subtotal <= 0) return;
    try {
      const res = await window.fetchWithRetry(`${CONFIG.API.BASE}/api/shipping/calculate?province=${encodeURIComponent(province)}&zip=${encodeURIComponent(zip)}&subtotal=${subtotal}`, {}, 1, 500);
      if (!res) return;
      const data = await res.json();
      const shipping = data.freeShipping ? 0 : (data.cost || CONFIG.CART.SHIPPING_COST);
      const total = subtotal + shipping;
      const totals = document.getElementById('summaryTotals');
      if (totals) {
        totals.innerHTML = `
          <div class="summary-row"><span>Subtotal</span><span>${formatARS(subtotal)}</span></div>
          <div class="summary-row"><span>Envío a ${data.province || province}</span><span>${shipping === 0 ? CONFIG.CART.FREE_SHIPPING_TEXT : formatARS(shipping)}</span></div>
          <div class="summary-row total"><span>Total</span><span>${formatARS(total)}</span></div>
        `;
      }
    } catch (e) {
      // noop
    }
  }

  Object.keys(checkoutFields).forEach(key => {
    const field = checkoutFields[key];
    if (!field) return;
    field.addEventListener('input', () => {
      if (checkoutErrors[key]) {
        clearFieldError(key);
      }
    });
    field.addEventListener('blur', () => {
      const msg = validateField(key, field.value);
      if (msg) {
        showFieldError(key, msg);
      } else {
        clearFieldError(key);
      }
    });
  });