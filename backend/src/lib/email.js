const RESEND_API_URL = 'https://api.resend.com/emails';
const BRAND_COLOR = '#d47090';

function isConfigured() {
  return Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM);
}

async function sendEmail({ to, subject, html }) {
  if (!isConfigured()) {
    console.warn('[email] RESEND_API_KEY o EMAIL_FROM no configurados — email no enviado:', subject);
    return { skipped: true };
  }
  if (!to) {
    return { skipped: true };
  }
  try {
    const res = await fetch(RESEND_API_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM,
        to,
        subject,
        html
      })
    });
    if (!res.ok) {
      const body = await res.text();
      console.error('[email] Resend respondió con error:', res.status, body);
      return { ok: false };
    }
    return { ok: true };
  } catch (err) {
    // Nunca tirar la orden/webhook abajo por un fallo de email.
    console.error('[email] Error enviando email:', err.message);
    return { ok: false };
  }
}

function escapeHtml(str) {
  return String(str || '').replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

function money(n) {
  return Number(n || 0).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function itemsRows(items) {
  return items.map((it) => `
    <tr>
      <td style="padding:8px 0;border-bottom:1px solid #f0dbe2;">${escapeHtml(it.name)}</td>
      <td style="padding:8px 0;border-bottom:1px solid #f0dbe2;text-align:center;">${escapeHtml(it.qty || it.quantity || 1)}</td>
      <td style="padding:8px 0;border-bottom:1px solid #f0dbe2;text-align:right;">$${money(it.unit_price || it.price)}</td>
    </tr>`).join('');
}

function baseLayout(title, bodyHtml) {
  return `
  <div style="font-family:Arial,sans-serif;background:#fdf6f8;padding:24px;">
    <div style="max-width:520px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #f0dbe2;">
      <div style="background:${BRAND_COLOR};padding:20px 24px;">
        <h1 style="color:#fff;margin:0;font-size:20px;">IARA — Artesanía Gualeguay</h1>
      </div>
      <div style="padding:24px;color:#3a2c31;">
        <h2 style="margin-top:0;font-size:18px;">${escapeHtml(title)}</h2>
        ${bodyHtml}
      </div>
      <div style="padding:16px 24px;background:#fdf6f8;color:#8a7076;font-size:12px;text-align:center;">
        Artesanía Gualeguay · Gualeguay, Entre Ríos
      </div>
    </div>
  </div>`;
}

async function sendOrderConfirmationEmail(order) {
  let items = [];
  try { items = JSON.parse(order.items || '[]'); } catch (e) { items = []; }

  const body = `
    <p>¡Gracias por tu compra, ${escapeHtml(order.customer_name || '')}! Confirmamos que recibimos tu pago.</p>
    <table style="width:100%;border-collapse:collapse;margin:16px 0;">
      <thead>
        <tr>
          <th style="text-align:left;padding-bottom:8px;border-bottom:2px solid ${BRAND_COLOR};">Producto</th>
          <th style="text-align:center;padding-bottom:8px;border-bottom:2px solid ${BRAND_COLOR};">Cant.</th>
          <th style="text-align:right;padding-bottom:8px;border-bottom:2px solid ${BRAND_COLOR};">Precio</th>
        </tr>
      </thead>
      <tbody>${itemsRows(items)}</tbody>
    </table>
    <p style="text-align:right;font-size:16px;"><strong>Total: $${money(order.total)}</strong></p>
    <p style="color:#8a7076;font-size:13px;">Pedido #${order.id}. Te vamos a avisar cuando lo despachemos.</p>
  `;

  return sendEmail({
    to: order.customer_email,
    subject: `Confirmamos tu pedido #${order.id} — IARA`,
    html: baseLayout('¡Tu pago fue aprobado! 🌸', body)
  });
}

async function sendOrderShippedEmail(order) {
  const body = `
    <p>Hola ${escapeHtml(order.customer_name || '')}, tu pedido #${order.id} ya está en camino.</p>
    <p style="color:#8a7076;font-size:13px;">Cualquier consulta, respondé este mail o escribinos por WhatsApp.</p>
  `;
  return sendEmail({
    to: order.customer_email,
    subject: `Tu pedido #${order.id} fue despachado — IARA`,
    html: baseLayout('¡Tu pedido está en camino! 📦', body)
  });
}

async function sendAdminNewOrderNotification(order) {
  const adminEmail = process.env.ADMIN_NOTIFICATION_EMAIL;
  if (!adminEmail) return { skipped: true };

  let items = [];
  try { items = JSON.parse(order.items || '[]'); } catch (e) { items = []; }

  const body = `
    <p>Nuevo pedido pago #${order.id} de <strong>${escapeHtml(order.customer_name || 'cliente')}</strong>.</p>
    <table style="width:100%;border-collapse:collapse;margin:16px 0;">
      <tbody>${itemsRows(items)}</tbody>
    </table>
    <p><strong>Total: $${money(order.total)}</strong></p>
    <p style="color:#8a7076;font-size:13px;">Tel: ${escapeHtml(order.customer_phone || '-')}<br/>Email: ${escapeHtml(order.customer_email || '-')}</p>
  `;

  return sendEmail({
    to: adminEmail,
    subject: `🔔 Nuevo pedido #${order.id} — $${money(order.total)}`,
    html: baseLayout('Nuevo pedido recibido', body)
  });
}

module.exports = {
  isConfigured,
  sendOrderConfirmationEmail,
  sendOrderShippedEmail,
  sendAdminNewOrderNotification
};
