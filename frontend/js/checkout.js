'use strict';

  /* eslint-disable no-unused-vars */

  function updateSummary() {
    const items = getCart();
    const container = document.getElementById('summaryItems');
    const totals = document.getElementById('summaryTotals');
    document.getElementById('emptyCart').style.display = items.length ? 'none' : 'block';
    document.getElementById('checkoutContent').style.display = items.length ? 'grid' : 'none';

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
    try {
      const res = await window.fetchWithRetry(`${CONFIG.API.BASE}/api/payment-config`, {}, 2, 1000);
      if (!res) {
        document.getElementById('mpAliasValue').textContent = 'No configurado';
        document.getElementById('transferAlias').textContent = 'No configurado';
        return { alias: 'iara-salgueiro', whatsapp: (CONFIG.CONTACT.WHATSAPP || '').replace(/[^\d]/g, ''), message: '', active: false };
      }
      const data = await res.json();
      const alias = data.transferAlias || 'iara-salgueiro';
      const cbuCvu = data.cbuCvu || '';
      const holderName = data.holderName || '';
      const whatsapp = (data.whatsapp || CONFIG.CONTACT.WHATSAPP || '').replace(/[^\d]/g, '');
      const message = data.message || 'Transferí el total exacto y enviá el comprobante por WhatsApp para confirmar tu pedido.';
      const active = data.active !== false;
      document.getElementById('mpAliasValue').textContent = alias || 'No configurado';
      document.getElementById('transferAlias').textContent = alias || 'No configurado';
      if (cbuCvu) {
        document.getElementById('transferCbuCvu').textContent = cbuCvu;
        document.getElementById('cbuCvuField').style.display = '';
      }
      if (holderName) {
        document.getElementById('transferHolder').textContent = holderName;
        document.getElementById('holderField').style.display = '';
      }
      return { alias, whatsapp, message, active };
    } catch (err) {
      document.getElementById('mpAliasValue').textContent = 'Error al cargar';
      document.getElementById('transferAlias').textContent = 'Error al cargar';
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
    if (!items.length) { showToast('', 'Carrito vacío', 'error'); return; }

    const shipping = {
      name: document.getElementById('shipName').value.trim(),
      address: document.getElementById('shipAddress').value.trim(),
      phone: document.getElementById('shipPhone').value.trim(),
      zip: document.getElementById('shipZip').value.trim(),
      city: document.getElementById('shipCity').value.trim(),
      email: document.getElementById('shipEmail').value.trim() || ''
    };

    if (!shipping.name || !shipping.address || !shipping.phone || !shipping.zip || !shipping.email) {
      showToast('', 'Completá todos los campos obligatorios', 'error');
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
          subtotal, shipping_cost: shippingCost, total
        })
      });
      if (!orderRes) throw new Error('Error al guardar el pedido');
      const orderData = await orderRes.json();
      if (!orderRes.ok) throw new Error(orderData.error || 'Error al guardar el pedido');

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
      const customerName = shipping.name || 'Cliente';
      const itemsList = items.map(i => {
        const line = `• ${i.name} x${i.qty} - ${formatARS(i.price * i.qty)}`;
        if (i.image) return `${line}\n  Imagen: ${i.image}`;
        return line;
      }).join('\n');
      const waMsg = encodeURIComponent(`Hola! Quiero confirmar el pago del pedido AG-${orderId} por un total de ${formatARS(total)}.\n\nCliente: ${customerName}\nProductos:\n${itemsList}\n\n${paymentConfig.message || 'Ya realicé la transferencia. Te envío el comprobante por este medio.'}`);
      document.getElementById('whatsappComprobanteBtn').href = `https://wa.me/${waNumber}?text=${waMsg}`;

      document.getElementById('checkoutContent').style.display = 'none';
      document.getElementById('emptyCart').style.display = 'none';
      document.getElementById('paymentInstructions').style.display = 'block';
    } catch (err) {
      showToast('', window.getFetchErrorMessage(err) || 'Error al procesar tu compra. Intentá nuevamente o contactanos.', 'error');
      console.error('Checkout error:', err);
    }
  });

  window.addEventListener('storage', updateSummary);

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', updateSummary);
  } else {
    updateSummary();
  }