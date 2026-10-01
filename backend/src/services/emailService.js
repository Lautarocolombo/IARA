const logger = require('../lib/logger');

const DEFAULT_FROM = 'noreply@artesaniagualeguay.com';

function getFrom() {
  return process.env.EMAIL_FROM || DEFAULT_FROM;
}

function getApiKey() {
  return process.env.RESEND_API_KEY || '';
}

async function sendEmail({ to, subject, html, text }) {
  const apiKey = getApiKey();
  if (!apiKey) {
    logger.warn('RESEND_API_KEY no configurado, se omite envío de email');
    return false;
  }

  if (!to || !subject) {
    logger.warn('sendEmail: faltan parámetros (to, subject)');
    return false;
  }

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: getFrom(),
        to,
        subject,
        html: html || '',
        text: text || ''
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      logger.error({ error: errorData, status: response.status }, 'Error enviando email');
      return false;
    }

    const data = await response.json();
    logger.info({ emailId: data.id, to }, 'Email enviado correctamente');
    return true;
  } catch (err) {
    logger.error({ err: err.message }, 'Error enviando email');
    return false;
  }
}

function buildTemplate(templateName, data = {}) {
  const businessName = process.env.BUSINESS_NAME || 'Artesanías Gualeguay';
  const businessEmail = process.env.BUSINESS_EMAIL || 'contacto@artesaniagualeguay.com';
  const siteUrl = process.env.SITE_URL || 'http://localhost:3000';

  const header = `
    <div style="max-width:600px;margin:0 auto;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#333;">
      <div style="background:#d47090;padding:24px;text-align:center;border-radius:8px 8px 0 0;">
        <h1 style="color:#fff;margin:0;font-size:22px;">${businessName}</h1>
      </div>
      <div style="padding:24px;background:#fef9f3;">
  `;

  const footer = `
      </div>
      <div style="padding:16px 24px;text-align:center;font-size:12px;color:#999;border-top:1px solid #eee;">
        <p>${businessName} — ${businessEmail}</p>
        <p>${siteUrl}</p>
      </div>
    </div>
  `;

  switch (templateName) {
    case 'order_confirmation': {
      const order = data.order || {};
      const orderId = String(order.id || '').padStart(4, '0');
      const total = Number(order.total || 0).toFixed(2);
      return `${header}
        <h2 style="color:#d47090;margin-top:0;">¡Gracias por tu pedido!</h2>
        <p>Tu pedido <strong>#${orderId}</strong> ha sido confirmado.</p>
        <table style="width:100%;border-collapse:collapse;margin:16px 0;">
          <tr><td style="padding:8px 0;font-weight:bold;">Total:</td><td>$${total}</td></tr>
          <tr><td style="padding:8px 0;font-weight:bold;">Estado:</td><td>Pendiente de pago</td></tr>
          <tr><td style="padding:8px 0;font-weight:bold;">Método de pago:</td><td>${order.payment_method || 'Transferencia'}</td></tr>
        </table>
        <p>Te contactaremos pronto para coordinar el envío.</p>
        ${footer}`;
    }

    case 'order_status_update': {
      const order = data.order || {};
      const status = data.status || '';
      const orderId = String(order.id || '').padStart(4, '0');
      const total = Number(order.total || 0).toFixed(2);
      return `${header}
        <h2 style="color:#d47090;margin-top:0;">Actualización de tu pedido</h2>
        <p>Tu pedido <strong>#${orderId}</strong> cambió a estado: <strong>${status}</strong></p>
        <table style="width:100%;border-collapse:collapse;margin:16px 0;">
          <tr><td style="padding:8px 0;font-weight:bold;">Total:</td><td>$${total}</td></tr>
          <tr><td style="padding:8px 0;font-weight:bold;">Nuevo estado:</td><td>${status}</td></tr>
        </table>
        ${footer}`;
    }

    case 'password_reset': {
      const resetLink = data.resetLink || `${siteUrl}/reset-password.html?token=`;
      const username = data.username || 'usuario';
      return `${header}
        <h2 style="color:#d47090;margin-top:0;">Recuperación de contraseña</h2>
        <p>Hola ${username},</p>
        <p>Recibimos una solicitud para restablecer tu contraseña. Hacé clic en el siguiente enlace:</p>
        <p><a href="${resetLink}" style="background:#d47090;color:#fff;padding:12px 24px;text-decoration:none;border-radius:4px;display:inline-block;">Restablecer contraseña</a></p>
        <p>Este enlace vence en 15 minutos.</p>
        <p>Si no solicitaste este cambio, ignorá este email.</p>
        ${footer}`;
    }

    case 'newsletter': {
      const title = data.title || 'Novedades de Artesanías Gualeguay';
      const content = data.content || '';
      return `${header}
        <h2 style="color:#d47090;margin-top:0;">${title}</h2>
        <p>${content}</p>
        ${footer}`;
    }

    default:
      return (data.html || '');
  }
}

async function sendOrderConfirmationEmail(order, customerEmail) {
  const subject = `Pedido confirmado #${String(order.id || '').padStart(4, '0')} - ${process.env.BUSINESS_NAME || 'Artesanías Gualeguay'}`;
  const html = buildTemplate('order_confirmation', { order });
  const text = `Pedido #${order.id} - Total: $${order.total || 0}. Estado: Pendiente de pago. Gracias por tu compra!`;
  return sendEmail({ to: customerEmail, subject, html, text });
}

async function sendOrderStatusEmail(order, customerEmail, status) {
  const subject = `Pedido #${String(order.id || '').padStart(4, '0')} - ${status}`;
  const html = buildTemplate('order_status_update', { order, status });
  const text = `Pedido #${order.id} cambió a estado: ${status}. Total: $${order.total || 0}`;
  return sendEmail({ to: customerEmail, subject, html, text });
}

async function sendPasswordResetEmail(username, resetLink) {
  const subject = 'Recuperación de contraseña - Artesanías Gualeguay';
  const html = buildTemplate('password_reset', { username, resetLink });
  const text = `Hola ${username}, solicitaste restablecer tu contraseña. Hacé clic: ${resetLink}`;
  return sendEmail({ to: '', subject, html, text });
}

async function sendNewsletterEmail(to, title, content, preheader) {
  const subject = title || 'Novedades de Artesanías Gualeguay';
  const html = buildTemplate('newsletter', { title, content, preheader });
  const text = `${title}\n\n${content}`;
  return sendEmail({ to, subject, html, text });
}

module.exports = {
  sendEmail,
  sendOrderConfirmationEmail,
  sendOrderStatusEmail,
  sendPasswordResetEmail,
  sendNewsletterEmail,
  buildTemplate
};
