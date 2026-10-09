'use strict';

/* eslint-disable no-unused-vars */

import { sanitizePhone, buildOrderMessage, buildWhatsAppLinks, copyToClipboard, getWhatsAppNumber, WA_PHONE } from './utils/whatsapp.js';

let appliedCoupon = null;
let shippingDiff = 0;
let shippingDiffProvince = '';
let includedShippingCost = 0;
let currentOrderId = null;
let currentOrderToken = '';

const WA_PHONE_DISPLAY = '+54 9 3444 63-4444';
const WA_PHONE_RAW = WA_PHONE;

async function fetchShippingDiff(province) {
  if (!province) {
    shippingDiff = 0;
    shippingDiffProvince = '';
    updateSummary();
    return;
  }
  try {
    const res = await window.fetchWithRetry(`/api/v1/shipping-diff?province=${encodeURIComponent(province)}`, {}, 1, 500);
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
    const res = await window.fetchWithRetry('/api/v1/coupons/validate', {
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

async function loadPaymentConfig() {
  const aliasEl = document.getElementById('paymentAliasValue');
  const holderEl = document.getElementById('paymentHolderValue');
  const holderBox = document.getElementById('holderBox');
  if (aliasEl) aliasEl.textContent = 'Cargando...';
  if (holderEl) holderEl.textContent = 'Cargando...';
  try {
    const url = '/api/v1/payment-config';
    const res = await window.fetchWithRetry(url, {}, 2, 1000, 8000);
    if (!res) {
      if (aliasEl) aliasEl.textContent = 'No configurado';
      if (holderEl) holderEl.textContent = 'No configurado';
      return { alias: CONFIG.CONTACT.WHATSAPP_ALIAS || '', whatsapp: WA_PHONE_RAW, message: '', active: false };
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
    if (aliasEl) aliasEl.textContent = alias || 'No configurado';
    if (holderName) {
      if (holderEl) holderEl.textContent = holderName;
      if (holderBox) holderBox.style.display = '';
    } else {
      if (holderBox) holderBox.style.display = 'none';
    }
    return { alias, whatsapp, message, active, notifyAdminNewProof: data.notifyAdminNewProof !== false, notifyClientApproved: data.notifyClientApproved !== false, notifyClientRejected: data.notifyClientRejected !== false };
  } catch (err) {
    if (aliasEl) aliasEl.textContent = 'Error al cargar';
    if (holderEl) holderEl.textContent = 'Error al cargar';
    return { alias: CONFIG.CONTACT.WHATSAPP_ALIAS || '', whatsapp: WA_PHONE_RAW, message: '', active: false };
  }
}

function copyAlias() {
  const alias = document.getElementById('paymentAliasValue').textContent;
  if (!alias || alias === 'No configurado' || alias === 'Error al cargar') {
    showToast('', 'Alias no disponible', 'error');
    return;
  }
  navigator.clipboard.writeText(alias).then(() => {
    const btn = document.getElementById('copyAliasBtn');
    btn.textContent = '✓ Copiado';
    setTimeout(() => { btn.textContent = '📋 Copiar'; }, 2000);
    showToast('', 'Alias copiado', 'success');
  }).catch(() => {
    showToast('', 'No se pudo copiar', 'error');
  });
}

function copyHolder() {
  const holder = document.getElementById('paymentHolderValue').textContent;
  if (!holder || holder === 'No configurado' || holder === 'Error al cargar') {
    showToast('', 'Dato no disponible', 'error');
    return;
  }
  navigator.clipboard.writeText(holder).then(() => {
    const btn = document.getElementById('copyHolderBtn');
    btn.textContent = '✓ Copiado';
    setTimeout(() => { btn.textContent = '📋 Copiar'; }, 2000);
    showToast('', 'Copiado', 'success');
  }).catch(() => {
    showToast('', 'No se pudo copiar', 'error');
  });
}

function buildWaMessage(orderNumber, items, subtotal, shippingCost, shippingProvince, shippingAddress, shippingCity, total, paymentMethod, alias) {
  const orderForMessage = {
    orderNumber,
    customerName: (document.getElementById('shipName')?.value.trim()) || 'Cliente',
    items: items.map(i => ({ name: i.name, qty: i.qty, price: i.price })),
    subtotal,
    shippingCost,
    shippingProvince,
    shippingAddress,
    shippingCity,
    total,
    paymentMethod,
    alias
  };
  return buildOrderMessage(orderForMessage);
}

async function openWhatsAppWithMessage(url) {
  const win = window.open('', '_blank', 'noopener,noreferrer');
  if (win) {
    win.location.href = url;
  } else {
    window.location.href = url;
  }
}

async function handleWhatsAppSend(orderNumber, items, subtotal, shippingCost, shippingProvince, shippingAddress, shippingCity, total, paymentMethod, alias, orderId, orderToken) {
  const btn = document.getElementById('sendWhatsappBtn');

  const msg = buildWaMessage(orderNumber, items, subtotal, shippingCost, shippingProvince, shippingAddress, shippingCity, total, paymentMethod, alias);
  const waLinks = buildWhatsAppLinks(WA_PHONE_RAW, msg);

  const url = waLinks.primary || waLinks.fallback;
  if (url) {
    await openWhatsAppWithMessage(url);
  }
}

function renderWhatsAppFallback(container, waNumber, waMsg, waLinks) {
  if (!container) return;
  const formattedNumber = WA_PHONE_DISPLAY;
  container.innerHTML = `
    <div class="whatsapp-fallback">
      <p>Se abrirá WhatsApp con tu pedido.</p>
      <div style="display: flex; flex-wrap: wrap; gap: 0.5rem; margin-bottom: 0.75rem;">
        <a href="${waLinks.fallback}" target="_blank" rel="noopener noreferrer" class="btn btn-secondary btn-sm" style="flex: 1; min-width: 140px; text-align: center;">
          Abrir en api.whatsapp.com
        </a>
        <button type="button" class="btn btn-secondary btn-sm" id="copyPhoneBtn" style="flex: 1; min-width: 120px;" data-phone="${waNumber}">
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
      const result = await copyToClipboard(waNumber, 'Número');
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

      const orderRes = await window.fetchWithRetry('/api/v1/orders', {
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

      currentOrderId = orderData.id || null;
      currentOrderToken = orderData.order_token || '';

      const paymentConfig = await loadPaymentConfig();
      document.getElementById('paymentTotalAmount').textContent = formatARS(total);

      if (!paymentConfig.active) {
        document.getElementById('paymentSection').style.display = 'none';
        document.getElementById('checkoutContent').style.display = 'grid';
        showToast('', 'El pago está temporalmente deshabilitado. Contáctanos por WhatsApp.', 'error');
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = 'Continuar al pago';
        }
        return;
      }

      const isCash = paymentMethod === 'cash';
      const orderId = currentOrderId;
      const orderNumber = `#${String(orderId).padStart(4, '0')}`;

      const paymentTitleEl = document.getElementById('paymentTitle');
      if (paymentTitleEl) {
        paymentTitleEl.textContent = isCash ? '💵 Pagar en efectivo' : '💳 Pagar por transferencia';
      }
      document.getElementById('paymentInstructionsText').textContent = isCash
        ? 'Tu pedido quedará reservado. Te contactaremos para coordinar el pago y entrega.'
        : 'Transferí el total exacto y enviá el comprobante por WhatsApp para confirmar tu pedido.';

      document.getElementById('paymentOrderId').textContent = orderNumber;
      document.getElementById('paymentTotalAmount').textContent = formatARS(total);

      document.getElementById('paymentSection').style.display = 'block';
      document.getElementById('paymentSection').scrollIntoView({ behavior: 'smooth', block: 'start' });

      const sendBtn = document.getElementById('sendWhatsappBtn');
      if (sendBtn) {
        sendBtn.onclick = async (e) => {
          e.preventDefault();
          await handleWhatsAppSend(orderNumber, items, subtotal, shippingCost, shipping.province, shipping.address, shipping.city, total, paymentMethod, paymentConfig.alias, orderId, currentOrderToken);
        };
      }

      const fallbackContent = document.getElementById('whatsappFallbackContent');
      const waNumberForFallback = WA_PHONE_RAW;
      const waMsgForFallback = buildWaMessage(orderNumber, items, subtotal, shippingCost, shipping.province, shipping.address, shipping.city, total, paymentMethod, paymentConfig.alias);
      const waLinksForFallback = buildWhatsAppLinks(waNumberForFallback, waMsgForFallback);
      renderWhatsAppFallback(fallbackContent, waNumberForFallback, waMsgForFallback, waLinksForFallback);

      sessionStorage.setItem('ag_last_order', JSON.stringify({
        id: orderId,
        number: orderNumber,
        total: total,
        items: items.map(i => ({ name: i.name, qty: i.qty, price: i.price })),
        waNumber: WA_PHONE_RAW,
        waMsg: waMsgForFallback,
        waLinks: waLinksForFallback,
        shippingName: shipping.name,
        shippingAddress: shipping.address,
        shippingCity: shipping.city,
        shippingProvince: shipping.province,
        shippingPhone: shipping.phone,
        shippingEmail: shipping.email,
        shippingCost: shippingCost,
        subtotal: subtotal,
        orderToken: currentOrderToken,
        paymentMethod
      }));

      try {
        await window.fetchWithRetry('/api/v1/payments/transfer', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Order-Token': currentOrderToken || ''
          },
          body: JSON.stringify({ orderId, amount: total, reference: `web-${Date.now()}` })
        });
      } catch (e) {
        console.warn('[checkout] No se pudo confirmar el pago automáticamente:', e);
      }

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

function copyMpAlias() {
  const alias = document.getElementById('paymentAliasValue').textContent;
  if (!alias || alias === 'No configurado' || alias === 'Error al cargar') {
    showToast('', 'Alias no disponible', 'error');
    return;
  }
  navigator.clipboard.writeText(alias).then(() => {
    const btn = document.getElementById('copyAliasBtn');
    btn.textContent = '✓ Copiado';
    setTimeout(() => { btn.textContent = '📋 Copiar'; }, 2000);
    showToast('', 'Alias copiado', 'success');
  }).catch(() => {
    showToast('', 'No se pudo copiar', 'error');
  });
}

function copyTransferField(field) {
  let text = '';
  let btnId = '';
  if (field === 'alias') {
    text = document.getElementById('paymentAliasValue')?.textContent || '';
    btnId = 'copyAliasBtn';
  } else if (field === 'holderName') {
    text = document.getElementById('paymentHolderValue')?.textContent || '';
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
      setTimeout(() => { btn.textContent = '📋 Copiar'; }, 2000);
    }
    showToast('', 'Copiado', 'success');
  }).catch(() => {
    showToast('', 'No se pudo copiar', 'error');
  });
}

function restoreOrderFromSession() {
  const raw = sessionStorage.getItem('ag_last_order');
  if (!raw) return;
  try {
    const order = JSON.parse(raw);
    if (order.number) {
      document.getElementById('paymentOrderId').textContent = order.number;
    }
    if (order.total) {
      document.getElementById('paymentTotalAmount').textContent = formatARS(order.total);
    }
    if (order.shippingProvince) {
      const provinceEl = document.getElementById('shipProvince');
      if (provinceEl) provinceEl.value = order.shippingProvince;
      fetchShippingDiff(order.shippingProvince);
    }

    currentOrderId = order.id || null;
    currentOrderToken = order.orderToken || '';

    const sendBtn = document.getElementById('sendWhatsappBtn');
    if (sendBtn) {
      sendBtn.onclick = async (e) => {
        e.preventDefault();
        await handleWhatsAppSend(
          order.number,
          order.items || [],
          order.subtotal || 0,
          order.shippingCost || 0,
          order.shippingProvince || '',
          order.shippingAddress || '',
          order.shippingCity || '',
          order.total || 0,
          order.paymentMethod || 'transfer',
          '',
          currentOrderId,
          currentOrderToken
        );
      };
    }

    const waNumber = WA_PHONE_RAW;
    const waMsg = buildWaMessage(order.number, order.items || [], order.subtotal || 0, order.shippingCost || 0, order.shippingProvince || '', order.shippingAddress || '', order.shippingCity || '', order.total || 0, order.paymentMethod || 'transfer', '');
    const waLinks = buildWhatsAppLinks(waNumber, waMsg);
    const fallbackContent = document.getElementById('whatsappFallbackContent');
    renderWhatsAppFallback(fallbackContent, waNumber, waMsg, waLinks);

    const paymentTitleEl = document.getElementById('paymentTitle');
    const isCash = order.paymentMethod === 'cash';
    if (paymentTitleEl) {
      paymentTitleEl.textContent = isCash ? '💵 Pagar en efectivo' : '💳 Pagar por transferencia';
    }
    document.getElementById('paymentSection').style.display = 'block';
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

startDataSync('payment-config', async () => {
  await loadPaymentConfig();
});

onSyncMessage('settings_updated', async () => {
  await loadPaymentConfig();
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

const copyAliasBtn = document.getElementById('copyAliasBtn');
if (copyAliasBtn) {
  copyAliasBtn.addEventListener('click', copyAlias);
}

const copyHolderBtn = document.getElementById('copyHolderBtn');
if (copyHolderBtn) {
  copyHolderBtn.addEventListener('click', copyHolder);
}

window.checkout = {
  validateField,
  updateSummary,
  fetchShippingDiff,
  applyCoupon,
  loadPaymentConfig,
  loadMpAlias: loadPaymentConfig,
  copyAlias,
  copyMpAlias: copyAlias,
  copyTransferField,
  showFieldError,
  clearFieldError,
  restoreOrderFromSession,
  buildWaMessage
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = window.checkout;
}
