'use strict';

  /* eslint-disable no-unused-vars */

  let appliedCoupon = null;
  let shippingDiff = 0;
  let shippingDiffProvince = '';
  let includedShippingCost = 0;

  async function fetchShippingDiff(province) {
    if (!province) {
      shippingDiff = 0;
      shippingDiffProvince = '';
      updateSummary();
      return;
    }
    try {
      const res = await window.fetchWithRetry(`${CONFIG.API.BASE}/api/shipping-diff?province=${encodeURIComponent(province)}`, {}, 1, 500);
      if (res && res.ok) {
        const data = await res.json();
        shippingDiff = Number(data.diff || 0);
        shippingDiffProvince = data.province || province;
        includedShippingCost = Number(data.included_shipping_cost || 0);
      } else {
        shippingDiff = 0;
        shippingDiffProvince = province;
      }
    } catch (err) {
      shippingDiff = 0;
      shippingDiffProvince = province;
    }
    updateSummary();
  }

  async function applyCoupon() {
    const codeEl = document.getElementById('couponCode');
    const errorEl = document.getElementById('couponError');
    const successEl = document.getElementById('couponSuccess');
    const code = codeEl ? codeEl.value.trim() : '';
    if (!code) {
      if (errorEl) { errorEl.textContent = 'Ingresá un código de cupón'; errorEl.style.display = 'block'; }
      if (successEl) successEl.style.display = 'none';
      appliedCoupon = null;
      updateSummary();
      return;
    }
    if (errorEl) { errorEl.textContent = ''; errorEl.style.display = 'none'; }
    if (successEl) successEl.style.display = 'none';

    const items = getCart();
    const subtotal = items.reduce((s, i) => s + i.price * i.qty, 0);

    try {
      const res = await window.fetchWithRetry(`${CONFIG.API.BASE}/api/coupons/validate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, amount: subtotal })
      }, 2, 1000);
      if (!res || !res.ok) {
        const data = await res.json().catch(() => ({ error: 'Cupón inválido' }));
        if (errorEl) { errorEl.textContent = data.error || 'Cupón inválido'; errorEl.style.display = 'block'; }
        appliedCoupon = null;
        updateSummary();
        return;
      }
      const data = await res.json();
      appliedCoupon = data;
      if (successEl) { successEl.textContent = `Cupón aplicado: descuento de ${formatARS(data.discount)}`; successEl.style.display = 'block'; }
      updateSummary();
    } catch (err) {
      if (errorEl) { errorEl.textContent = 'Error validando cupón'; errorEl.style.display = 'block'; }
      appliedCoupon = null;
      updateSummary();
    }
  }

  function updateSummary() {
    const items = getCart();
    const container = document.getElementById('summaryItems');
    const totals = document.getElementById('summaryTotals');
    const hasPendingOrder = !!sessionStorage.getItem('ag_last_order');
    const emptyCart = document.getElementById('emptyCart');
    const checkoutContent = document.getElementById('checkoutContent');
    if (emptyCart) emptyCart.style.display = items.length || hasPendingOrder ? 'none' : 'block';
    if (checkoutContent) checkoutContent.style.display = items.length || hasPendingOrder ? 'grid' : 'none';

    if (container) {
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
    }

    const subtotal = items.reduce((s, i) => s + i.price * i.qty, 0);
    const freeShippingFrom = Number(CONFIG.CART.SHIPPING_THRESHOLD) || 0;
    let shipping = 0;
    let shippingLabel = CONFIG.CART.FREE_SHIPPING_TEXT;

    if (subtotal < freeShippingFrom) {
      if (shippingDiff > 0 && shippingDiffProvince) {
        shipping = shippingDiff;
        shippingLabel = `Diferencia de zona (${shippingDiffProvince})`;
      } else if (CONFIG.CART.SHIPPING_COST > 0) {
        shipping = CONFIG.CART.SHIPPING_COST;
        shippingLabel = formatARS(shipping);
      }
    }

    const couponDiscount = appliedCoupon ? Number(appliedCoupon.discount || 0) : 0;
    const total = subtotal - couponDiscount + shipping;

    if (totals) {
      totals.innerHTML = `
        <div class="summary-row"><span>Subtotal productos</span><span>${formatARS(subtotal)}</span></div>
        ${couponDiscount > 0 ? `<div class="summary-row" style="color:#10b981;"><span>Descuento</span><span>-${formatARS(couponDiscount)}</span></div>` : ''}
        <div class="summary-row"><span>Envío</span><span>${shippingLabel}</span></div>
        <div class="summary-row total"><span>Total</span><span>${formatARS(total)}</span></div>
      `;
    }

    const progressWrap = document.getElementById('freeShippingProgressCheckout');
    const progressFill = document.getElementById('freeShippingFillCheckout');
    const progressText = document.getElementById('freeShippingTextCheckout');
    if (progressWrap && progressFill && progressText) {
      if (shipping === 0) {
        progressWrap.style.display = 'none';
      } else {
        progressWrap.style.display = 'block';
        const threshold = Number(CONFIG.CART.SHIPPING_THRESHOLD) || 0;
        const remaining = threshold - subtotal;
        const pct = threshold > 0 ? Math.min(100, Math.max(0, (subtotal / threshold) * 100)) : 100;
        progressFill.style.width = pct + '%';
        progressText.textContent = 'Te faltan ' + formatARS(remaining) + ' para envío gratis';
      }
    }

    updateCartBadge();
  }

  async function loadMpAlias() {
     const aliasEl = document.getElementById('mpAliasValue');
     const transferAliasEl = document.getElementById('transferAlias');
     if (aliasEl) aliasEl.textContent = 'Cargando...';
     if (transferAliasEl) transferAliasEl.textContent = 'Cargando...';
     try {
       const url = `${CONFIG.API.BASE}/api/payment-config`;
        const res = await window.fetchWithRetry(url, {}, 2, 1000, 8000);
        if (!res) {
          if (aliasEl) aliasEl.textContent = 'No configurado';
          if (transferAliasEl) transferAliasEl.textContent = 'No configurado';
         return { alias: CONFIG.CONTACT.WHATSAPP_ALIAS || '', whatsapp: (CONFIG.CONTACT.WHATSAPP || '').replace(/[^\d]/g, ''), message: '', active: false, mpEnabled: false };
        }
        const data = await res.json();
        if (data.shippingCost !== undefined) CONFIG.CART.SHIPPING_COST = Number(data.shippingCost);
        if (data.freeShippingFrom !== undefined) CONFIG.CART.SHIPPING_THRESHOLD = Number(data.freeShippingFrom);
        if (data.includedShippingCost !== undefined) includedShippingCost = Number(data.includedShippingCost);
        const alias = data.transferAlias || '';
       const cbuCvu = data.cbuCvu || '';
       const holderName = data.holderName || '';
       const whatsapp = (data.whatsapp || CONFIG.CONTACT.WHATSAPP || '').replace(/[^\d]/g, '');
       const message = data.message || 'Transferí el total exacto y enviá el comprobante por WhatsApp para confirmar tu pedido.';
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
       return { alias, whatsapp, message, active, mpEnabled };
      } catch (err) {
       if (aliasEl) aliasEl.textContent = 'Error al cargar';
       if (transferAliasEl) transferAliasEl.textContent = 'Error al cargar';
        return { alias: CONFIG.CONTACT.WHATSAPP_ALIAS || '', whatsapp: (CONFIG.CONTACT.WHATSAPP || '').replace(/[^\d]/g, ''), message: '', active: false };
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

  let isSubmitting = false;
  const shippingForm = document.getElementById('shippingForm');
  if (shippingForm) {
    shippingForm.addEventListener('submit', async (e) => {
    if (isSubmitting) return;
    isSubmitting = true;
    e.preventDefault();

    const items = getCart();
    if (!items.length) {
      showToast('', 'Carrito vacío', 'error');
      isSubmitting = false;
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

    const consentEl = document.getElementById('checkoutConsent');
    if (!consentEl?.checked) {
      showToast('', 'Aceptá la política de privacidad y cookies para continuar', 'error');
      isSubmitting = false;
      consentEl?.focus();
      return;
    }

    if (hasErrors) {
      const firstError = Object.keys(errors).find(k => errors[k]);
      if (firstError && fields[firstError]) {
        fields[firstError].focus();
      }
      isSubmitting = false;
      return;
    }

    const subtotal = items.reduce((s, i) => s + i.price * i.qty, 0);
    const freeShippingFrom = Number(CONFIG.CART.SHIPPING_THRESHOLD) || 0;
    let shippingCost = 0;
    if (subtotal < freeShippingFrom) {
      if (shippingDiff > 0 && shipping.province) {
        shippingCost = shippingDiff;
      } else if (CONFIG.CART.SHIPPING_COST > 0) {
        shippingCost = CONFIG.CART.SHIPPING_COST;
      }
    }
    const couponDiscount = appliedCoupon ? Number(appliedCoupon.discount || 0) : 0;
    const total = subtotal - couponDiscount + shippingCost;

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
          shipping_city: shipping.province || shipping.city,
          subtotal,
          shipping_cost: shippingCost,
          total,
          couponCode: appliedCoupon ? appliedCoupon.code : ''
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
        showToast('', 'El pago está temporalmente deshabilitado. Contáctanos por WhatsApp.', 'error');
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
      const productList = items.map(i => `- ${i.name} x${i.qty} = ${formatARS(i.price * i.qty)}`).join('\n');
      const shippingLine = shippingCost > 0 && shipping.province
        ? `Diferencia de envío (${shipping.province}): ${formatARS(shippingCost)}`
        : (shippingCost === 0 ? 'Envío incluido en el precio' : `Envío: ${formatARS(shippingCost)}`);
      const waMsg = encodeURIComponent(`Hola! Soy ${customerName}, acabo de hacer el pedido ${orderNumber}:\n${productList}\nSubtotal productos: ${formatARS(subtotal)}\n${shippingLine}\nTotal: ${formatARS(total)}\nLes mando el comprobante de la transferencia.`);

      sessionStorage.setItem('ag_last_order', JSON.stringify({
        id: orderId,
        number: orderNumber,
        total: total,
        items: items.map(i => ({ name: i.name, qty: i.qty, price: i.price })),
        waNumber,
        waMsg,
        shippingName: shipping.name,
        shippingAddress: shipping.address,
        shippingCity: shipping.city,
        shippingProvince: shipping.province,
        shippingPhone: shipping.phone,
        shippingEmail: shipping.email,
        shippingCost: shippingCost,
        subtotal: subtotal,
        orderToken: orderData.order_token || ''
      }));
      try {
        localStorage.setItem('ag_pending_order', JSON.stringify({
          id: orderId,
          number: orderNumber,
          total: total,
          items: items.map(i => ({ name: i.name, qty: i.qty, price: i.price })),
          waNumber,
          waMsg,
          shippingName: shipping.name,
          shippingAddress: shipping.address,
          shippingCity: shipping.city,
          shippingProvince: shipping.province,
          shippingPhone: shipping.phone,
          shippingEmail: shipping.email,
          shippingCost: shippingCost,
          subtotal: subtotal,
          orderToken: orderData.order_token || '',
          savedAt: Date.now()
        }));
      } catch (e) {
        console.warn('[checkout] No se pudo guardar pedido pendiente en localStorage:', e);
      }

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
      const shippingBreakdown = document.getElementById('transferShippingBreakdown');
      if (shippingBreakdown) {
        if (shippingCost > 0 && shipping.province) {
          shippingBreakdown.innerHTML = `<div class='transfer-item-row' style='color:#d47090;'><span class='transfer-item-name'>Diferencia de envío (${shipping.province})</span><span class='transfer-item-price'>${formatARS(shippingCost)}</span></div>`;
          shippingBreakdown.style.display = '';
        } else if (shippingCost === 0) {
          shippingBreakdown.innerHTML = '<div class=\'transfer-item-row\' style=\'color:#10b981;\'><span class=\'transfer-item-name\'>Envío incluido en el precio</span><span class=\'transfer-item-price\'>$0</span></div>';
          shippingBreakdown.style.display = '';
        } else {
          shippingBreakdown.style.display = 'none';
        }
      }
      document.getElementById('transferOrderTotalHighlight').textContent = formatARS(total);

      document.getElementById('whatsappComprobanteBtn').href = `https://wa.me/${waNumber}?text=${waMsg}`;
      document.getElementById('transferReceiptBtn').href = `https://wa.me/${waNumber}?text=${waMsg}`;
      document.getElementById('transferReceiptBtn').dataset.orderNumber = orderNumber;
      document.getElementById('transferReceiptBtn').dataset.orderId = orderId;

      try {
        const orderToken = (() => {
          const raw = sessionStorage.getItem('ag_last_order');
          if (!raw) return '';
          try {
            const order = JSON.parse(raw);
            return order.orderToken || '';
          } catch {
            return '';
          }
        })();
        await window.fetchWithRetry(`${CONFIG.API.BASE}/api/payments/transfer`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Order-Token': orderToken || ''
          },
          body: JSON.stringify({ orderId, amount: total, reference: `web-${Date.now()}` })
        });
      } catch (e) {
        console.warn('[checkout] No se pudo confirmar el pago automáticamente:', e);
      }

      document.getElementById('paymentInstructions').style.display = 'block';
      document.getElementById('transferDataCard').style.display = 'block';
      document.getElementById('shippingForm').style.display = 'none';

      emitSync('order_created');
     } catch (err) {
      showToast('', window.getFetchErrorMessage(err) || 'Error al procesar tu compra. Intentá nuevamente o contactanos.', 'error');
      console.error('Checkout error:', err);
    } finally {
      isSubmitting = false;
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Continuar al pago';
      }
    }
  });
}

  window.addEventListener('storage', updateSummary);

  function restoreOrderFromSession() {
    const sources = [
      { key: 'ag_pending_order', storage: localStorage },
      { key: 'ag_last_order', storage: sessionStorage }
    ];
    let raw = null;
    for (const src of sources) {
      try {
        raw = src.storage.getItem(src.key);
        if (raw) break;
      } catch (e) {
        continue;
      }
    }
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
      if (order.shippingProvince) {
        const provinceEl = document.getElementById('shipProvince');
        if (provinceEl) provinceEl.value = order.shippingProvince;
        fetchShippingDiff(order.shippingProvince);
      }
      if (order.waNumber && order.waMsg) {
        document.getElementById('whatsappComprobanteBtn').href = `https://wa.me/${order.waNumber}?text=${order.waMsg}`;
        document.getElementById('transferReceiptBtn').href = `https://wa.me/${order.waNumber}?text=${order.waMsg}`;
        document.getElementById('transferReceiptBtn').dataset.orderNumber = order.number;
        document.getElementById('transferReceiptBtn').dataset.orderId = order.id || '';
      }
      document.getElementById('paymentInstructions').style.display = 'block';
      document.getElementById('transferDataCard').style.display = 'block';
      document.getElementById('shippingForm').style.display = 'none';
    } catch (e) {
      console.error('Error restaurando pedido desde sesión:', e);
    }
  }

  function clearSavedOrder() {
    try { sessionStorage.removeItem('ag_last_order'); } catch (e) {}
    try { localStorage.removeItem('ag_pending_order'); } catch (e) {}
  }

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', async () => {
        if (typeof window.loadPaymentConfig === 'function') {
          await window.loadPaymentConfig();
        }
        updateSummary();
        restoreOrderFromSession();
      });
    } else {
      (async () => {
        if (typeof window.loadPaymentConfig === 'function') {
          await window.loadPaymentConfig();
        }
        updateSummary();
        restoreOrderFromSession();
      })();
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

  function validateField(key, value) {
    if (key === 'name' && !value.trim()) return 'Ingresá tu nombre';
    if (key === 'address' && !value.trim()) return 'Ingresá tu dirección';
    if (key === 'zip' && !value.trim()) return 'Ingresá el código postal';
    if (key === 'city' && !value.trim()) return 'Ingresá tu localidad';
    if (key === 'province' && !value.trim()) return 'Seleccioná tu provincia';
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

  const provinceField = document.getElementById('shipProvince');
  if (provinceField) {
    provinceField.addEventListener('change', () => {
      clearFieldError('province');
      fetchShippingDiff(provinceField.value.trim());
    });
  }

  const applyCouponBtn = document.getElementById('applyCouponBtn');
  if (applyCouponBtn) {
    applyCouponBtn.addEventListener('click', applyCoupon);
  }

  window.checkout = {
    validateField,
    updateSummary,
    fetchShippingDiff,
    applyCoupon,
    loadMpAlias,
    copyMpAlias,
    copyTransferField,
    showFieldError,
    clearFieldError,
    restoreOrderFromSession,
    clearSavedOrder
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = window.checkout;
  }