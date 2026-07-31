const crypto = require('crypto');
const { MercadoPago, Preference, Payment } = require('mercadopago');
const { query } = require('../lib/db');
const { isValidTransition } = require('./ordersController');
const { sendOrderConfirmationEmail, sendAdminNewOrderNotification } = require('../lib/email');

async function verifyMercadoPagoWebhook(req, res, next) {
  const webhookSecret = process.env.MP_WEBHOOK_SECRET;
  if (!webhookSecret) {
    return next();
  }

  const signature = req.headers['x-signature'];
  const requestId = req.headers['x-request-id'] || '';
  if (!signature || typeof signature !== 'string') {
    return res.status(400).send('Missing signature');
  }

  const params = new URLSearchParams(signature);
  const ts = params.get('ts');
  const v1 = params.get('v1');
  if (!ts || !v1) {
    return res.status(400).send('Invalid signature format');
  }

  const data = req.body || {};
  const manifest = `id:${data.data?.id || data.id};request-id:${requestId};ts:${ts}`;
  const expected = crypto.createHmac('sha256', webhookSecret).update(manifest).digest('hex');

  if (v1 !== expected) {
    return res.status(401).send('Invalid signature');
  }

  next();
}

async function createPreference(req, res) {
  try {
    const accessToken = process.env.MP_ACCESS_TOKEN;
    if (!accessToken) {
      return res.status(500).json({ error: 'Servidor no configurado para pagos' });
    }

    const client = new MercadoPago({ accessToken });

    const body = req.body || {};
    const clientItems = body.items || [];

    if (clientItems.length === 0) {
      return res.status(400).json({ error: 'El carrito está vacío' });
    }

    const productIds = clientItems.map(item => Number(item.id)).filter(id => id > 0);
    const uniqueIds = [...new Set(productIds)];

    const productResults = await Promise.all(
      uniqueIds.map(id => query('SELECT id, name, price, stock FROM products WHERE id = $1', [id]))
    );

    const dbProducts = {};
    for (const result of productResults) {
      if (result.rows.length > 0) {
        const p = result.rows[0];
        dbProducts[p.id] = { name: p.name, price: Number(p.price), stock: Number(p.stock) };
      }
    }

    const preferenceItems = [];
    let totalAmount = 0;

    for (const item of clientItems) {
      const productId = Number(item.id);
      const qty = Number(item.quantity) || Number(item.qty) || 1;

      if (!dbProducts[productId]) {
        return res.status(400).json({ error: `Producto ${productId} no encontrado` });
      }

      const product = dbProducts[productId];
      if (product.stock < qty) {
        return res.status(409).json({ error: `Stock insuficiente para ${product.name}. Disponible: ${product.stock}` });
      }

      const unitPrice = product.price;
      const lineTotal = unitPrice * qty;
      totalAmount += lineTotal;

      preferenceItems.push({
        title: product.name,
        quantity: qty,
        unit_price: unitPrice,
        currency_id: 'ARS'
      });
    }

    const preference = new Preference(client);
    const idempotencyKey = body.idempotency_key || `ag-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    const result = await preference.create({
      items: preferenceItems,
      payer: body.payer || {},
      external_reference: body.external_reference || '',
      back_urls: body.back_urls || {},
      auto_return: body.auto_return || 'approved',
      shipment: body.shipment || {}
    }, { idempotencyKey });

    res.status(201).json({
      id: result.id,
      init_point: result.init_point,
      sandbox_init_point: result.sandbox_init_point,
      total_amount: totalAmount
    });
  } catch (err) {
    console.error('Error creando preferencia MP:', err);
    res.status(500).json({ error: 'Error interno al crear la preferencia de pago' });
  }
}

async function handleWebhook(req, res) {
  const accessToken = process.env.MP_ACCESS_TOKEN;
  if (!accessToken) {
    console.error('MP_ACCESS_TOKEN no configurado');
    return res.status(500).send('Missing MP_ACCESS_TOKEN');
  }

  const { type, data } = req.body || {};
  if (type !== 'payment' || !data || !data.id) {
    return res.status(200).send('Ignored');
  }

  const paymentId = String(data.id);

  const maxRetries = 3;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const client = new MercadoPago({ accessToken });
      const payment = new Payment(client);
      const response = await payment.get(paymentId);
      const paymentData = response.body || {};

      const mpStatus = paymentData.status || '';
      const externalRef = paymentData.external_reference || '';
      const orderIdMatch = externalRef.match(/^(?:AG-)?(\d+)$/);
      const orderId = orderIdMatch ? Number(orderIdMatch[1]) : null;

      const existingPaymentResult = await query('SELECT * FROM payments WHERE mercadopago_id = $1', [paymentId]);
      const existingOrderResult = orderId ? await query('SELECT id, status, items FROM orders WHERE id = $1', [orderId]) : { rows: [] };

      if (existingPaymentResult.rows.length > 0) {
        const existing = existingPaymentResult.rows[0];
        if (existing.status === mpStatus) {
          return res.status(200).send('Already processed');
        }
        await query('UPDATE payments SET status = $1, status_detail = $2, raw_response = $3, updated_at = CURRENT_TIMESTAMP WHERE mercadopago_id = $4', [mpStatus, paymentData.status_detail || '', JSON.stringify(paymentData), paymentId]);
      } else {
        if (!orderId || existingOrderResult.rows.length === 0) {
          await query('INSERT INTO payments (mercadopago_id, status, status_detail, amount, currency, raw_response) VALUES ($1, $2, $3, $4, $5, $6)', [paymentId, mpStatus, paymentData.status_detail || '', paymentData.transaction_amount || 0, paymentData.currency_id || 'ARS', JSON.stringify(paymentData)]);
          return res.status(200).send('Stored without order');
        }
        await query('INSERT INTO payments (order_id, mercadopago_id, status, status_detail, amount, currency, payment_method_id, payment_type_id, raw_response) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)', [orderId, paymentId, mpStatus, paymentData.status_detail || '', paymentData.transaction_amount || 0, paymentData.currency_id || 'ARS', paymentData.payment_method_id || '', paymentData.payment_type_id || '', JSON.stringify(paymentData)]);
      }

      if (!orderId || existingOrderResult.rows.length === 0) {
        return res.status(200).send('No order linked');
      }

      const currentOrderStatus = existingOrderResult.rows[0].status;

      if (mpStatus === 'approved' && currentOrderStatus !== 'approved') {
        if (!isValidTransition(currentOrderStatus, 'approved')) {
          return res.status(200).send('OK');
        }
        const orderResult = await query('UPDATE orders SET status = $1, mercadopago_id = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3 RETURNING *', ['approved', paymentId, orderId]);
        const order = orderResult.rows[0];
        try {
          const items = JSON.parse(order.items || '[]');
          for (const item of items) {
            const productId = Number(item.id);
            const qty = Number(item.qty || 1);
            if (!productId) continue;
            await require('./ordersController').adjustStock(productId, qty, 'sale', orderId, `Pago aprobado - Orden #${orderId}`);
          }
        } catch (stockErr) {
          console.error('Error descontando stock en webhook:', stockErr);
        }
        await query('INSERT INTO order_status_history (order_id, status, notes) VALUES ($1, $2, $3)', [orderId, 'approved', `Pago aprobado (MP: ${paymentId})`]);
        // Emails no deben frenar el webhook si fallan.
        sendOrderConfirmationEmail(order).catch((e) => console.error('Error mail confirmación:', e.message));
        sendAdminNewOrderNotification(order).catch((e) => console.error('Error mail admin:', e.message));
      } else if ((mpStatus === 'rejected' || mpStatus === 'cancelled' || mpStatus === 'expired' || mpStatus === 'charged_back') && currentOrderStatus !== 'cancelled' && currentOrderStatus !== 'rejected') {
        const newStatus = mpStatus === 'charged_back' ? 'chargeback' : 'cancelled';
        if (!isValidTransition(currentOrderStatus, newStatus)) {
          return res.status(200).send('OK');
        }
        await query('UPDATE orders SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2', [newStatus, orderId]);
        await query('INSERT INTO order_status_history (order_id, status, notes) VALUES ($1, $2, $3)', [orderId, newStatus, `Pago ${mpStatus} (MP: ${paymentId})`]);
        if (currentOrderStatus === 'approved' || currentOrderStatus === 'pending_payment') {
          try {
            const orderRes = await query('SELECT items FROM orders WHERE id = $1', [orderId]);
            const items = JSON.parse(orderRes.rows[0].items || '[]');
            for (const item of items) {
              const productId = Number(item.id);
              const qty = Number(item.qty || 1);
              if (!productId) continue;
              await require('./ordersController').adjustStock(productId, qty, 'return', orderId, `Devolución por pago ${mpStatus}`);
            }
          } catch (refundErr) {
            console.error('Error devolviendo stock en webhook:', refundErr);
          }
        }
      } else if (mpStatus === 'in_process' || mpStatus === 'pending') {
        if (currentOrderStatus !== 'in_process') {
          if (!isValidTransition(currentOrderStatus, 'in_process')) {
            return res.status(200).send('OK');
          }
          await query('UPDATE orders SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2', ['in_process', orderId]);
          await query('INSERT INTO order_status_history (order_id, status, notes) VALUES ($1, $2, $3)', [orderId, 'in_process', `Pago en proceso (MP: ${paymentId})`]);
        }
      }

      return res.status(200).send('OK');
    } catch (err) {
      console.error(`Error procesando webhook MP (intento ${attempt}/${maxRetries}):`, err.message);
      if (attempt === maxRetries) {
        return res.status(500).send('Error');
      }
      await new Promise(r => setTimeout(r, 1000 * attempt));
    }
  }
  return res.status(500).send('Error');
}

module.exports = { createPreference, handleWebhook, verifyMercadoPagoWebhook };
