/* ==================== SHARED PAYMENT LOGIC ====================
 * Módulo compartido de lógica de pago/transferencia.
 * Usado por checkout.html y success.html para evitar duplicación.
 */

const SharedPayment = (function () {
  'use strict';

  async function loadPaymentConfig() {
    try {
      const res = await window.fetchWithRetry(`${CONFIG.API.BASE}/api/payment-config`, {}, 2, 1000);
      if (!res) return null;
      return await res.json();
    } catch (e) {
      console.error('Error cargando payment config:', e);
      return null;
    }
  }

  function getTransferAlias(data) {
    return data?.transferAlias || data?.mpAlias || CONFIG.CONTACT.WHATSAPP_ALIAS || '';
  }

  function getWhatsAppNumber(data) {
    return (data?.whatsapp || CONFIG.CONTACT.WHATSAPP || '').replace(/[^\d]/g, '');
  }

  function getTransferMessage(data) {
    return data?.message || 'Transferí el total exacto y enviá el comprobante por WhatsApp para confirmar tu pedido.';
  }

  function buildTransferWhatsAppMessage(order, items, alias) {
    const lines = [
      `Hola! Quiero confirmar el pago de mi pedido ${order.number || '#' + order.id}:`,
      '',
      'Datos del cliente:',
      `Nombre: ${order.shippingName || 'No especificado'}`,
      `Dirección: ${order.shippingAddress || 'No especificada'}`,
      `Localidad: ${order.shippingCity || 'No especificada'}`,
      `Provincia: ${order.shippingProvince || 'No especificada'}`,
      `Código postal: ${order.shippingZip || 'No especificado'}`,
      `Email: ${order.shippingEmail || 'No especificado'}`,
      '',
      'Productos:'
    ];
    items.forEach((it, idx) => {
      lines.push(`${idx + 1}. ${it.name || 'Producto'} x${it.qty || 1} — ${formatARS(it.price || 0)}`);
    });
    lines.push('');
    lines.push(`Subtotal: ${formatARS(order.subtotal || 0)}`);
    lines.push(`Envío: ${order.shippingCost === 0 ? 'GRATIS' : formatARS(order.shippingCost || 0)}`);
    lines.push(`Total: ${formatARS(order.total || 0)}`);
    lines.push('');
    if (order.paymentMethod === 'transfer') {
      lines.push('Te envío el comprobante de pago por transferencia.');
    } else {
      lines.push(`Te envío el comprobante de pago por MercadoPago al alias ${alias || 'configurado'}.`);
    }
    return encodeURIComponent(lines.join('\n'));
  }

  function copyText(text, btn) {
    if (!text || text === 'No configurado' || text === 'Error al cargar') {
      showToast('', 'Dato no disponible', 'error');
      return;
    }
    navigator.clipboard.writeText(text).then(() => {
      if (btn) {
        const original = btn.textContent;
        btn.textContent = '✓ Copiado';
        setTimeout(() => { btn.textContent = original; }, 2000);
      }
      showToast('', 'Copiado', 'success');
    }).catch(() => {
      showToast('', 'No se pudo copiar', 'error');
    });
  }

  return {
    loadPaymentConfig,
    getTransferAlias,
    getWhatsAppNumber,
    getTransferMessage,
    buildTransferWhatsAppMessage,
    copyText
  };
})();

window.SharedPayment = SharedPayment;
