'use strict';

  /* eslint-disable no-unused-vars */
  /* global openWhatsAppSafe */

  import { sanitizePhone, buildOrderMessage, buildWhatsAppLinks, copyToClipboard, getWhatsAppNumber } from './utils/whatsapp.js';

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
        return { alias, whatsapp, message, active, mpEnabled, notifyAdminNewProof: data.notifyAdminNewProof !== false, notifyClientApproved: data.notifyClientApproved !== false, notifyClientRejected: data.notifyClientRejected !== false };
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
      const paymentMethodEl = document.getElementById('paymentMethod');
      const paymentMethod = paymentMethodEl ? paymentMethodEl.value : 'transfer';

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
          shipping_city: shipping.city || '',
          shipping_province: shipping.province,
          subtotal,
          shipping_cost: shippingCost,
          total,
          couponCode: appliedCoupon ? appliedCoupon.code : '',
          payment_method: paymentMethod
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

      const isCash = paymentMethod === 'cash';

      const orderId = orderData.id || 'NUEVO';
      const orderNumber = `#${String(orderId).padStart(4, '0')}`;
      const customerName = shipping.name || 'Cliente';

      const orderForMessage = {
        orderNumber,
        customerName,
        items: items.map(i => ({ name: i.name, qty: i.qty, price: i.price })),
        subtotal,
        shippingCost,
        shippingProvince: shipping.province,
        shippingAddress: shipping.address,
        shippingCity: shipping.city,
        total,
        paymentMethod,
        alias: paymentConfig.alias
      };

      const waMsg = buildOrderMessage(orderForMessage);
      const waNumber = await getWhatsAppNumber() || paymentConfig.whatsapp || sanitizePhone(CONFIG.CONTACT.WHATSAPP || '');
      const waLinks = buildWhatsAppLinks(waNumber, waMsg);

      sessionStorage.setItem('ag_last_order', JSON.stringify({
        id: orderId,
        number: orderNumber,
        total: total,
        items: items.map(i => ({ name: i.name, qty: i.qty, price: i.price })),
        waNumber,
        waMsg,
        waLinks,
        shippingName: shipping.name,
        shippingAddress: shipping.address,
        shippingCity: shipping.city,
        shippingProvince: shipping.province,
        shippingPhone: shipping.phone,
        shippingEmail: shipping.email,
        shippingCost: shippingCost,
        subtotal: subtotal,
        orderToken: orderData.order_token || '',
        paymentMethod
      }));

      const paymentInstructionsEl = document.getElementById('paymentInstructions');
      const paymentTitleEl = paymentInstructionsEl ? paymentInstructionsEl.querySelector('h2') : null;
      const paymentNoteEl = document.getElementById('paymentInstructionsText');
      if (paymentTitleEl) {
        paymentTitleEl.textContent = isCash ? '💵 Pagar en efectivo' : '💳 Pagar por transferencia';
      }
      if (paymentNoteEl) {
        paymentNoteEl.textContent = isCash
          ? 'Tu pedido quedará reservado. Te contactaremos para coordinar el pago y entrega.'
          : 'Transferí el total exacto y envíanos el comprobante por WhatsApp para confirmar tu pedido.';
      }

      document.getElementById('paymentOrderId').textContent = orderNumber;
      document.getElementById('paymentOrderTotal').textContent = formatARS(total);
      document.getElementById('paymentTotalAmount').textContent = formatARS(total);

      if (!isCash) {
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
      }

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

      document.getElementById('paymentInstructions').style.display = 'block';
      document.getElementById('transferDataCard').style.display = isCash ? 'none' : 'block';
      document.getElementById('shippingForm').style.display = 'none';

      try {
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

      setupWhatsAppButtons(waNumber, waMsg, waLinks, orderNumber, orderId, isCash);
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

function setupWhatsAppButtons(waNumber, waMsg, waLinks, orderNumber, orderId, isCash) {
    const comprobanteBtn = document.getElementById('whatsappComprobanteBtn');
    const transferReceiptBtn = document.getElementById('transferReceiptBtn');
    const fallbackContainer = document.getElementById('whatsappFallback');
    const fallbackContainerTransfer = document.getElementById('whatsappFallbackTransfer');

    const buttonText = isCash ? 'Coordinar pago por WhatsApp' : 'Enviar comprobante por WhatsApp';

    if (comprobanteBtn) {
      comprobanteBtn.href = waLinks.primary;
      comprobanteBtn.textContent = buttonText;
      comprobanteBtn.setAttribute('data-wa-primary', waLinks.primary);
      comprobanteBtn.setAttribute('data-wa-fallback', waLinks.fallback);
      comprobanteBtn.setAttribute('data-wa-deeplink', waLinks.deeplink);
      comprobanteBtn.removeEventListener('click', handleWhatsAppClick);
      comprobanteBtn.addEventListener('click', handleWhatsAppClick);
    }

    if (transferReceiptBtn) {
      transferReceiptBtn.href = waLinks.primary;
      transferReceiptBtn.textContent = buttonText;
      transferReceiptBtn.setAttribute('data-wa-primary', waLinks.primary);
      transferReceiptBtn.setAttribute('data-wa-fallback', waLinks.fallback);
      transferReceiptBtn.setAttribute('data-wa-deeplink', waLinks.deeplink);
      transferReceiptBtn.dataset.orderNumber = orderNumber;
      transferReceiptBtn.dataset.orderId = orderId;
      transferReceiptBtn.style.display = isCash ? 'none' : '';
      transferReceiptBtn.removeEventListener('click', handleWhatsAppClick);
      transferReceiptBtn.addEventListener('click', handleWhatsAppClick);
    }

    if (fallbackContainer) {
      renderWhatsAppFallback(fallbackContainer, waNumber, waMsg, waLinks);
    }

    if (fallbackContainerTransfer) {
      renderWhatsAppFallback(fallbackContainerTransfer, waNumber, waMsg, waLinks);
    }
  }

 function handleWhatsAppClick(e) {
    const btn = e.currentTarget;
    const primary = btn.getAttribute('data-wa-primary');
    const fallback = btn.getAttribute('data-wa-fallback');
    const deeplink = btn.getAttribute('data-wa-deeplink');

    if (!primary || !fallback) return;

    e.preventDefault();

    if (typeof openWhatsAppSafe === 'function') {
      openWhatsAppSafe(primary, fallback, deeplink);
      return;
    }

    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

    if (isMobile && deeplink) {
      const link = document.createElement('a');
      link.href = deeplink;
      link.style.display = 'none';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      setTimeout(() => {
        window.open(fallback, '_blank', 'noopener,noreferrer');
      }, 1500);
    } else {
      window.open(primary, '_blank', 'noopener,noreferrer');
    }
  }

function renderWhatsAppFallback(container, waNumber, waMsg, waLinks) {
    const waPhone = waNumber.startsWith('54') ? waNumber : `54${waNumber}`;
    const formattedNumber = waPhone.replace(/(\d{2})(\d{2})(\d{4,5})(\d{4})/, '+$1 $2 $3 $4');

    container.innerHTML = `
      <div class="whatsapp-fallback" style="margin-top: 1rem; padding: 1rem; background: #fef3f7; border: 1px solid #fbcfe8; border-radius: 8px;">
        <h4 style="margin: 0 0 0.5rem; color: #9d174d; font-size: 0.95rem;">¿No se abrió WhatsApp?</h4>
        <p style="margin: 0 0 0.75rem; font-size: 0.85rem; color: #7c2d4e;">
          Se abrirá WhatsApp con tu pedido. Adjuntá ahí la captura o PDF de la transferencia.
        </p>
        <div style="display: flex; flex-wrap: wrap; gap: 0.5rem; margin-bottom: 0.75rem;">
          <a href="${waLinks.fallback}" target="_blank" rel="noopener noreferrer" class="btn btn-secondary btn-sm" style="flex: 1; min-width: 140px; text-align: center;">
            Abrir en api.whatsapp.com
          </a>
          <button type="button" class="btn btn-secondary btn-sm" id="copyPhoneBtn" style="flex: 1; min-width: 120px;" data-phone="${waPhone}">
            📋 Copiar número
          </button>
          <button type="button" class="btn btn-secondary btn-sm" id="copyMessageBtn" style="flex: 1; min-width: 140px;" data-message="${waMsg.replace(/"/g, '"')}">
            📋 Copiar mensaje del pedido
          </button>
        </div>
        <div style="font-size: 0.85rem; color: #7c2d4e; word-break: break-all;">
          <strong>Número:</strong> ${formattedNumber}
        </div>
      </div>
    `;

    const copyPhoneBtn = container.querySelector('#copyPhoneBtn');
    const copyMessageBtn = container.querySelector('#copyMessageBtn');

    if (copyPhoneBtn) {
      copyPhoneBtn.addEventListener('click', async () => {
        const result = await copyToClipboard(waPhone, 'Número');
        showToast('', result.message, result.success ? 'success' : 'error');
      });
    }

    if (copyMessageBtn) {
      copyMessageBtn.addEventListener('click', async () => {
        const result = await copyToClipboard(waMsg, 'Mensaje del pedido');
        showToast('', result.message, result.success ? 'success' : 'error');
      });
    }
  }

  function setupReceiptUpload(orderId, orderToken) {
    const fileInput = document.getElementById('receiptFile');
    const fileInputTransfer = document.getElementById('receiptFileTransfer');
    const uploadBtn = document.getElementById('uploadReceiptBtn');
    const uploadBtnTransfer = document.getElementById('uploadReceiptBtnTransfer');
    const errorEl = document.getElementById('receiptFileError');
    const errorElTransfer = document.getElementById('receiptFileTransferError');
    const statusEl = document.getElementById('receiptUploadStatus');
    const statusElTransfer = document.getElementById('receiptUploadStatusTransfer');

    function validateFile(file) {
      const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
      const maxSize = 5 * 1024 * 1024;
      if (!allowedTypes.includes(file.type)) {
        return 'Tipo de archivo no permitido. Usá JPG, PNG, WEBP o PDF.';
      }
      if (file.size > maxSize) {
        return 'El archivo es muy grande (máx. 5 MB).';
      }
      return null;
    }

    function handleFileSelect(input, btn, errEl) {
      const file = input.files[0];
      if (file) {
        const err = validateFile(file);
        if (err) {
          errEl.textContent = err;
          errEl.style.display = 'block';
          btn.disabled = true;
        } else {
          errEl.textContent = '';
          errEl.style.display = 'none';
          btn.disabled = false;
        }
      } else {
        btn.disabled = true;
      }
    }

    async function handleUpload(input, btn, statusEl) {
      const file = input.files[0];
      if (!file) return;
      const err = validateFile(file);
      if (err) {
        statusEl.textContent = err;
        statusEl.style.color = '#dc2626';
        statusEl.style.display = 'block';
        return;
      }

      btn.disabled = true;
      btn.textContent = 'Subiendo...';
      statusEl.style.display = 'none';

      const formData = new FormData();
      formData.append('image', file);

      try {
        const res = await fetch(`${CONFIG.API.BASE}/api/payments/proofs/${orderId}`, {
          method: 'POST',
          headers: {
            'X-Order-Token': orderToken || ''
          },
          body: formData
        });

        if (!res.ok) {
          const data = await res.json().catch(() => ({ error: 'Error al subir' }));
          throw new Error(data.error || 'Error al subir comprobante');
        }

        statusEl.textContent = '✅ Comprobante subido correctamente. El equipo lo revisará.';
        statusEl.style.color = '#16a34a';
        statusEl.style.display = 'block';
        input.value = '';
        btn.disabled = true;
        btn.textContent = 'Subir comprobante';
        showToast('', 'Comprobante subido', 'success');
      } catch (e) {
        statusEl.textContent = '❌ ' + (e.message || 'Error al subir comprobante');
        statusEl.style.color = '#dc2626';
        statusEl.style.display = 'block';
        btn.disabled = false;
        btn.textContent = 'Subir comprobante';
        showToast('', e.message || 'Error al subir', 'error');
      }
    }

    if (fileInput && uploadBtn) {
      fileInput.addEventListener('change', () => handleFileSelect(fileInput, uploadBtn, errorEl));
      uploadBtn.addEventListener('click', () => handleUpload(fileInput, uploadBtn, statusEl));
    }

    if (fileInputTransfer && uploadBtnTransfer) {
      fileInputTransfer.addEventListener('change', () => handleFileSelect(fileInputTransfer, uploadBtnTransfer, errorElTransfer));
      uploadBtnTransfer.addEventListener('click', () => handleUpload(fileInputTransfer, uploadBtnTransfer, statusElTransfer));
    }
  }

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
      if (order.shippingProvince) {
        const provinceEl = document.getElementById('shipProvince');
        if (provinceEl) provinceEl.value = order.shippingProvince;
        fetchShippingDiff(order.shippingProvince);
      }
      if (order.waNumber && order.waMsg) {
        const waLinks = order.waLinks || buildWhatsAppLinks(order.waNumber, order.waMsg);
        const isCash = order.paymentMethod === 'cash';
        setupWhatsAppButtons(order.waNumber, order.waMsg, waLinks, order.number, order.id || '', isCash);
      } else if (order.waNumber) {
        const waMsg = buildOrderMessage({
          orderNumber: order.number,
          customerName: order.shippingName || 'Cliente',
          items: order.items || [],
          subtotal: order.subtotal || 0,
          shippingCost: order.shippingCost || 0,
          shippingProvince: order.shippingProvince || '',
          shippingAddress: order.shippingAddress || '',
          shippingCity: order.shippingCity || '',
          total: order.total || 0,
          paymentMethod: order.paymentMethod || 'transfer',
          alias: ''
        });
        const waLinks = buildWhatsAppLinks(order.waNumber, waMsg);
        const isCash = order.paymentMethod === 'cash';
        setupWhatsAppButtons(order.waNumber, waMsg, waLinks, order.number, order.id || '', isCash);
      }
      const paymentInstructionsEl = document.getElementById('paymentInstructions');
      const paymentTitleEl = paymentInstructionsEl ? paymentInstructionsEl.querySelector('h2') : null;
      const isCash = order.paymentMethod === 'cash';
      if (paymentTitleEl) {
        paymentTitleEl.textContent = isCash ? '💵 Pagar en efectivo' : '💳 Pagar por transferencia';
      }
      document.getElementById('paymentInstructions').style.display = 'block';
      document.getElementById('transferDataCard').style.display = isCash ? 'none' : 'block';
      document.getElementById('shippingForm').style.display = 'none';
    } catch (e) {
      console.error('Error restaurando pedido desde sesión:', e);
    }
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
    restoreOrderFromSession
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = window.checkout;
  }