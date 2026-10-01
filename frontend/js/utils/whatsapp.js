'use strict';

export const MAX_URL_LENGTH = 1800;
export const MAX_MESSAGE_LENGTH = 1600;

export function sanitizePhone(phone) {
  if (!phone) return '';
  let cleaned = String(phone).replace(/[^\d]/g, '');
  if (cleaned.startsWith('549')) {
    cleaned = cleaned.slice(3);
  }
  if (cleaned.startsWith('54')) {
    cleaned = cleaned.slice(2);
  }
  if (cleaned.startsWith('15')) {
    cleaned = cleaned.slice(2);
  }
  if (cleaned.startsWith('0')) {
    cleaned = cleaned.slice(1);
  }
  return cleaned;
}

export function formatARS(amount) {
  try {
    return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(Number(amount));
  } catch {
    return '$' + amount;
  }
}

export function buildOrderMessage(order) {
  const {
    orderNumber,
    customerName,
    items,
    subtotal,
    shippingCost,
    shippingProvince,
    shippingAddress,
    shippingCity,
    total,
    paymentMethod,
    alias
  } = order;

  const lines = [];
  lines.push(`Hola! Soy ${customerName}, acabo de hacer el pedido ${orderNumber}:`);

  if (Array.isArray(items) && items.length) {
    items.forEach(item => {
      const name = (item.name || 'Producto').replace(/[😀-🙏🌀-🗿🚀-🛿]/gu, '').trim();
      const qty = item.qty || 1;
      const price = item.price || 0;
      const lineTotal = price * qty;
      lines.push(`- ${name} x${qty} = ${formatARS(lineTotal)}`);
    });
  }

  lines.push(`Subtotal productos: ${formatARS(subtotal)}`);

  if (shippingCost > 0 && shippingProvince) {
    lines.push(`Diferencia de envio (${shippingProvince}): ${formatARS(shippingCost)}`);
  } else if (shippingCost === 0) {
    lines.push('Envio incluido en el precio');
  } else if (shippingCost > 0) {
    lines.push(`Envio: ${formatARS(shippingCost)}`);
  }

  if (shippingAddress) {
    const addrParts = [shippingAddress, shippingCity, shippingProvince].filter(Boolean);
    if (addrParts.length) {
      lines.push(`Direccion: ${addrParts.join(', ')}`);
    }
  }

  if (alias) {
    lines.push(`Alias Mercado Pago: ${alias}`);
  }

  lines.push(`Total: ${formatARS(total)}`);

  if (paymentMethod === 'cash') {
    lines.push('Voy a pagar en efectivo al retirar/recibir.');
  } else {
    lines.push('Les mando el comprobante de la transferencia.');
  }

  let message = lines.join('\n');

  if (message.length > MAX_MESSAGE_LENGTH) {
    message = truncateMessage(message, order);
  }

  return message;
}

export function truncateMessage(message, _order) {
  const lines = message.split('\n');
  const header = lines[0];
  const footer = lines.slice(-3).join('\n');
  const maxBodyLength = MAX_MESSAGE_LENGTH - header.length - footer.length - 20;

  let bodyLines = lines.slice(1, -3);
  let currentLength = 0;
  const keptLines = [];

  for (const line of bodyLines) {
    if (currentLength + line.length + 1 > maxBodyLength) {
      const remaining = bodyLines.length - keptLines.length;
      if (remaining > 0) {
        keptLines.push(`... y ${remaining} producto(s) mas`);
      }
      break;
    }
    keptLines.push(line);
    currentLength += line.length + 1;
  }

  return [header, ...keptLines, footer].join('\n');
}

export function truncateMessageForUrl(message, maxLength) {
  if (message.length <= maxLength) return message;
  const truncated = message.substring(0, maxLength - 3);
  const lastNewline = truncated.lastIndexOf('\n');
  if (lastNewline > maxLength * 0.5) {
    return truncated.substring(0, lastNewline) + '...';
  }
  return truncated + '...';
}

export function buildWhatsAppLinks(phone, message) {
  const cleanPhone = sanitizePhone(phone);
  const waPhone = cleanPhone.startsWith('54') ? cleanPhone : `54${cleanPhone}`;
  const encodedMessage = encodeURIComponent(message);

  const primary = `https://wa.me/${waPhone}?text=${encodedMessage}`;
  const fallback = `https://api.whatsapp.com/send?phone=${waPhone}&text=${encodedMessage}`;
  const deeplink = `whatsapp://send?phone=${waPhone}&text=${encodedMessage}`;

  let finalPrimary = primary;
  let finalFallback = fallback;

  const primaryBaseLen = `https://wa.me/${waPhone}?text=`.length;
  const fallbackBaseLen = `https://api.whatsapp.com/send?phone=${waPhone}&text=`.length;
  const maxBaseLen = Math.max(primaryBaseLen, fallbackBaseLen);

  if (primary.length > MAX_URL_LENGTH || fallback.length > MAX_URL_LENGTH) {
    const shortMessage = truncateMessageForUrl(message, MAX_URL_LENGTH - maxBaseLen);
    const shortEncoded = encodeURIComponent(shortMessage);
    finalPrimary = `https://wa.me/${waPhone}?text=${shortEncoded}`;
    finalFallback = `https://api.whatsapp.com/send?phone=${waPhone}&text=${shortEncoded}`;
  }

  return { primary: finalPrimary, fallback: finalFallback, deeplink };
}

export async function fetchWhatsAppNumberFromAPI() {
  try {
    const res = await fetch('/api/site-settings', { credentials: 'same-origin', cache: 'no-store' });
    if (res && res.ok) {
      const data = await res.json();
      if (data.whatsapp) return sanitizePhone(data.whatsapp);
    }
  } catch {
    return null;
  }
  return null;
}

export async function getWhatsAppNumber() {
  const fromAPI = await fetchWhatsAppNumberFromAPI();
  if (fromAPI) return fromAPI;

  const fromConfig = (typeof window !== 'undefined' && window.CONFIG && window.CONFIG.CONTACT && window.CONFIG.CONTACT.WHATSAPP) || '';
  const fromEnv = (typeof process !== 'undefined' && process.env && process.env.VITE_WHATSAPP_NUMBER) || '';
  return sanitizePhone(fromConfig || fromEnv || '');
}

export function copyToClipboard(text, label = 'Texto') {
  return navigator.clipboard.writeText(text)
    .then(() => ({ success: true, message: `${label} copiado` }))
    .catch(() => ({ success: false, message: `No se pudo copiar ${label.toLowerCase()}` }));
}

export function isMobile() {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
}

export function openWhatsApp(links) {
  if (isMobile()) {
    const link = document.createElement('a');
    link.href = links.deeplink;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    setTimeout(() => {
      window.open(links.fallback, '_blank', 'noopener,noreferrer');
    }, 1500);
  } else {
    window.open(links.primary, '_blank', 'noopener,noreferrer');
  }
}

// Global for browser
if (typeof window !== 'undefined') {
  window.WhatsAppUtils = {
    sanitizePhone,
    buildOrderMessage,
    buildWhatsAppLinks,
    openWhatsApp,
    copyToClipboard,
    getWhatsAppNumber,
    formatARS,
    MAX_URL_LENGTH,
    MAX_MESSAGE_LENGTH,
    isMobile,
    truncateMessage,
    truncateMessageForUrl
  };
}