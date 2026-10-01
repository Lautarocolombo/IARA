const logger = require('../lib/logger');
const { query } = require('../lib/db');

const MP_BASE_URL = 'https://api.mercadopago.com';

function getAccessToken() {
  return process.env.MP_ACCESS_TOKEN || '';
}

function getPublicKey() {
  return process.env.MP_PUBLIC_KEY || '';
}

function getIntegratorId() {
  return process.env.MP_INTEGRATOR_ID || '';
}

async function createPreference(items, payerEmail, backUrls, notificationUrl) {
  try {
    const accessToken = getAccessToken();
    if (!accessToken) {
      logger.warn('MP_ACCESS_TOKEN no configurado');
      return { error: 'Mercado Pago no configurado' };
    }

    const itemsFormatted = (items || []).map(item => ({
      title: item.name || item.title || 'Producto',
      quantity: item.quantity || 1,
      unit_price: Number(item.price || item.unit_price || 0),
      currency_id: 'ARS',
      description: item.description || '',
      picture_url: item.image || item.picture_url || '',
      id: String(item.id || '')
    }));

    const body = {
      items: itemsFormatted,
      payer: {
        email: payerEmail || ''
      },
      back_urls: backUrls || {
        success: `${process.env.SITE_URL || 'http://localhost:3000'}/payment-success.html`,
        failure: `${process.env.SITE_URL || 'http://localhost:3000'}/payment-failure.html`,
        pending: `${process.env.SITE_URL || 'http://localhost:3000'}/payment-pending.html`
      },
      auto_return: 'approved',
      notification_url: notificationUrl || `${process.env.BACKEND_URL || process.env.SITE_URL || 'http://localhost:3000'}/api/payments/webhook/mercadopago`
    };

    const response = await fetch(`${MP_BASE_URL}/checkout/preferences`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        ...(getIntegratorId() ? { 'x-integrator-id': getIntegratorId() } : {})
      },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      logger.error({ status: response.status, error: errorData }, 'Error creando preferencia MP');
      return { error: 'Error al crear preferencia de pago', details: errorData };
    }

    const data = await response.json();
    logger.info({ preferenceId: data.id }, 'Preferencia MP creada');
    return data;
  } catch (err) {
    logger.error({ err: err.message }, 'Error creando preferencia MP');
    return { error: err.message };
  }
}

async function getPaymentStatus(paymentId) {
  try {
    const accessToken = getAccessToken();
    if (!accessToken) {
      return { error: 'Mercado Pago no configurado' };
    }

    const response = await fetch(`${MP_BASE_URL}/payments/${paymentId}`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      logger.error({ status: response.status, error: errorData }, 'Error consultando estado MP');
      return { error: 'Error al consultar estado de pago' };
    }

    const data = await response.json();
    return {
      id: data.id,
      status: data.status,
      status_detail: data.status_detail,
      payment_method: data.payment_method ? {
        id: data.payment_method.id,
        type: data.payment_method.type,
        card_last_four: data.payment_method.card_last_four,
        card_name: data.payment_method.card_name,
        issuer: data.payment_method.issuer,
        installment: data.payment_method.installments
      } : null,
      transaction_amount: data.transaction_amount,
      currency_id: data.currency_id,
      date_created: data.date_created,
      date_approved: data.date_approved,
      payer: data.payer,
      order: data.order
    };
  } catch (err) {
    logger.error({ err: err.message }, 'Error consultando estado MP');
    return { error: err.message };
  }
}

async function processWebhookNotification(payload) {
  let eventId;
  try {
    const { type, data } = payload || {};

    if (!data || !data.id) {
      logger.warn('Webhook MP sin data.id');
      return { processed: false, reason: 'sin_data' };
    }

    const eventId = `mp_${data.id}_${type || 'payment'}`;
    const id = Number(data.id);

    const existing = await query(
      'SELECT id, status FROM webhook_events WHERE event_id = $1',
      [eventId]
    );

    if (existing.rows.length > 0 && existing.rows[0].status === 'processed') {
      return { processed: true, deduplicated: true, eventId };
    }

    await query(
      `INSERT INTO webhook_events (event_id, source, payload, status, tenant_id)
       VALUES ($1, $2, $3, 'processing', COALESCE(current_setting('app.current_tenant', TRUE), 'default'))
       ON CONFLICT (event_id) DO NOTHING RETURNING status`,
      [eventId, 'mercadopago', JSON.stringify(payload), 'processing']
    );

    if (type === 'payment' && payload && payload.action === 'payment.updated') {
      const paymentInfo = await getPaymentStatus(id);

      if (!paymentInfo.error) {
        const result = await query('SELECT id, status, total FROM orders WHERE id = $1', [id]);
        if (result.rows.length > 0) {
          const order = result.rows[0];
          let newStatus = order.status;
          if (paymentInfo.status === 'approved') {
            newStatus = 'confirmed';
          } else if (paymentInfo.status === 'rejected' || paymentInfo.status === 'cancelled') {
            newStatus = 'cancelled';
          } else if (paymentInfo.status === 'pending') {
            newStatus = 'pending';
          }

          if (newStatus !== order.status) {
            await query('UPDATE orders SET status = $1 WHERE id = $2', [newStatus, id]);
            logger.info({ orderId: id, status: newStatus }, 'Estado de orden actualizado por webhook MP');
          }
        }

        await query(
          'UPDATE webhook_events SET status = $1, processed_at = CURRENT_TIMESTAMP WHERE event_id = $2',
          ['processed', eventId]
        );

        return { processed: true, eventId, paymentStatus: paymentInfo.status };
      }
    } else if (type === 'payment') {
      await query(
        'UPDATE webhook_events SET status = $1, processed_at = CURRENT_TIMESTAMP WHERE event_id = $2',
        ['processed', eventId]
      );
      return { processed: true, eventId };
    }

    await query(
      'UPDATE webhook_events SET status = $1, processed_at = CURRENT_TIMESTAMP WHERE event_id = $2',
      ['processed', eventId]
    );

    return { processed: true, eventId };
  } catch (err) {
    logger.error({ err: err.message }, 'Error procesando webhook MP');
    if (eventId) {
      await query(
        'UPDATE webhook_events SET status = $1 WHERE event_id = $2',
        ['error', eventId]
      ).catch(() => {});
    }
    return { processed: false, error: err.message };
  }
}

async function createPaymentMethod(payload) {
  try {
    const accessToken = getAccessToken();
    if (!accessToken) return { error: 'Mercado Pago no configurado' };

    const response = await fetch(`${MP_BASE_URL}/v1/payment_methods`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload || {})
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return { error: 'Error creando método de pago', details: errorData };
    }

    return await response.json();
  } catch (err) {
    logger.error({ err: err.message }, 'Error creando método de pago MP');
    return { error: err.message };
  }
}

function getSupportedPaymentMethods() {
  return [
    { id: 'visa', name: 'Visa', type: 'credit_card', 'installments': 6 },
    { id: 'mastercard', name: 'Mastercard', type: 'credit_card', 'installments': 6 },
    { id: 'amex', name: 'American Express', type: 'credit_card', 'installments': 3 },
    { id: 'naranja', name: 'Naranja', type: 'credit_card', 'installments': 6 },
    { id: 'nobelcard', name: 'Nobelcard', type: 'credit_card', 'installments': 6 },
    { id: 'transfer', name: 'Transferencia bancaria', type: 'bank_transfer' },
    { id: 'cash', name: 'Pago en efectivo', type: 'cash' },
    { id: 'mercado_pago', name: 'Mercado Pago', type: 'account_money' }
  ];
}

module.exports = {
  createPreference,
  getPaymentStatus,
  processWebhookNotification,
  createPaymentMethod,
  getSupportedPaymentMethods,
  getAccessToken,
  getPublicKey
};
