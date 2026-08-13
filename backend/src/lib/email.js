const logger = require('./logger');

async function sendEmail({ to, subject, html, text }) {
  try {
    const resendApiKey = process.env.RESEND_API_KEY || '';
    if (!resendApiKey) {
      logger.warn('RESEND_API_KEY no configurado, se omite envío de email');
      return false;
    }

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM || 'noreply@artesaniagualeguay.com',
        to,
        subject,
        html,
        text
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

async function sendOrderConfirmationEmail(order, customerEmail) {
  const subject = `Pedido confirmado #${String(order.id).padStart(4, '0')} - Artesanía Gualeguay`;
  const html = `
    <h1>¡Gracias por tu pedido!</h1>
    <p>Tu pedido <strong>#${String(order.id).padStart(4, '0')}</strong> ha sido confirmado.</p>
    <p><strong>Total:</strong> $${Number(order.total).toFixed(2)}</p>
    <p><strong>Estado:</strong> Pendiente de pago</p>
    <p>Te contactaremos pronto para coordinar el envío.</p>
    <hr/>
    <p>Artesanía Gualeguay</p>
  `;
  return sendEmail({ to: customerEmail, subject, html });
}

async function sendOrderStatusEmail(order, customerEmail, status) {
  const subject = `Pedido #${String(order.id).padStart(4, '0')} - ${status}`;
  const html = `
    <h1>Actualización de tu pedido</h1>
    <p>Tu pedido <strong>#${String(order.id).padStart(4, '0')}</strong> ahora está en estado: <strong>${status}</strong></p>
    <p><strong>Total:</strong> $${Number(order.total).toFixed(2)}</p>
    <hr/>
    <p>Artesanía Gualeguay</p>
  `;
  return sendEmail({ to: customerEmail, subject, html });
}

module.exports = {
  sendEmail,
  sendOrderConfirmationEmail,
  sendOrderStatusEmail
};
