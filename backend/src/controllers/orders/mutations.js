const crypto = require('crypto');
const { query, transaction } = require('../../lib/db');
const logger = require('../../lib/logger');
const { orderSchema, roundMoney } = require('../../lib/validators');
const { syncBus } = require('../../routes/sync');
const { safeJsonParse } = require('../../lib/parser');
const { deleteImageAsset } = require('../../lib/upload');
const { sendOrderConfirmationEmail } = require('../../lib/email');
const { restoreStockForOrder, checkAndUpdateStock, restoreStockOnCancellation, restoreStockOnBatchDelete } = require('./stock');
const { logActivity } = require('./activities');

const VALID_STATUSES = ['pending', 'confirmed', 'preparing', 'shipped', 'delivered', 'cancelled'];

async function deleteOrderAttachments(orderId) {
  const urls = [];
  try {
    const proofs = await query('SELECT proof_url FROM payment_proofs WHERE order_id = $1', [orderId]);
    urls.push(...proofs.rows.map(r => r.proof_url).filter(Boolean));
    await query('DELETE FROM payment_proofs WHERE order_id = $1', [orderId]);
  } catch (err) {
    logger.warn({ err: err.message, orderId }, 'No se pudieron limpiar payment_proofs del pedido archivado');
  }
  try {
    const receipts = await query('SELECT url FROM receipts WHERE order_id = $1', [orderId]);
    urls.push(...receipts.rows.map(r => r.url).filter(Boolean));
    await query('DELETE FROM receipts WHERE order_id = $1', [orderId]);
  } catch (err) {
    logger.warn({ err: err.message, orderId }, 'No se pudieron limpiar receipts del pedido archivado');
  }
  try {
    const o = await query('SELECT receipt_url FROM orders WHERE id = $1', [orderId]);
    if (o.rows[0] && o.rows[0].receipt_url) urls.push(o.rows[0].receipt_url);
  } catch (err) {
    logger.warn({ err: err.message, orderId }, 'No se pudo leer receipt_url del pedido archivado');
  }
  let cleaned = 0;
  for (const url of urls) {
    try {
      if (await deleteImageAsset({ url })) cleaned++;
    } catch (err) {
      logger.warn({ err: err.message, orderId }, 'No se pudo borrar archivo de comprobante');
    }
  }
  if (urls.length > 0) {
    logger.info({ orderId, files: urls.length, cleaned }, 'Comprobantes huérfanos limpiados al archivar');
  }
  return cleaned;
}

async function createOrder(req, res) {
  logger.info('createOrder: inicio');
  const { items, total, customer, shipping_name, shipping_address, shipping_phone, shipping_zip, shipping_city, shipping_province, shipping_email, shipping_cost, notes, idempotency_key, couponCode, payment_method } = req.body || {};
  logger.info('createOrder: body parseado');

  if (idempotency_key) {
    const existing = await query('SELECT id, status FROM orders WHERE order_token = $1', [String(idempotency_key)]);
    if (existing.rows.length > 0) {
      logger.info({ orderId: existing.rows[0].id }, 'createOrder: idempotency key encontrada, retornando orden existente');
      return res.status(200).json({ ...existing.rows[0], cached: true });
    }
  }

  const validation = orderSchema.safeParse({ items, total, customer });
  if (!validation.success) {
    logger.info('createOrder: validacion fallida');
    return res.status(400).json({ error: validation.error.issues[0]?.message || 'Datos inválidos' });
  }

  const validatedItems = validation.data.items;

  if (!validatedItems || !validatedItems.length || !total) {
    logger.info('createOrder: items/total faltantes');
    return res.status(400).json({ error: 'Items y total son requeridos' });
  }

  try {
    logger.info('createOrder: intentando transaccion');
    const customerData = (typeof customer === 'object' && customer) ? { ...customer } : {};
    if (shipping_name) customerData.name = shipping_name;
    if (shipping_address) customerData.address = shipping_address;
    if (shipping_phone) customerData.phone = shipping_phone;
    if (shipping_email) customerData.email = shipping_email;
    if (shipping_zip) customerData.zip = shipping_zip;
    if (shipping_city) customerData.city = shipping_city;
    if (shipping_province) customerData.province = shipping_province;

    const orderToken = idempotency_key || crypto.randomUUID();

    const productIds = validatedItems.map(item => Number(item.id));
    let productResult;
    if (productIds.length === 1) {
      productResult = await query('SELECT id, price FROM products WHERE id = $1', [productIds[0]]);
    } else {
      const placeholders = productIds.map((_, i) => `$${i + 1}`).join(',');
      productResult = await query(`SELECT id, price FROM products WHERE id IN (${placeholders})`, productIds);
    }
    const priceMap = {};
    productResult.rows.forEach(row => {
      priceMap[row.id] = Number(row.price);
    });

    let calculatedSubtotal = 0;
    for (const item of validatedItems) {
      const dbPrice = priceMap[Number(item.id)];
      if (dbPrice === undefined) {
        throw new Error(`Producto ${item.id} no encontrado en la base de datos`);
      }
      item.price = dbPrice;
      calculatedSubtotal += dbPrice * Number(item.quantity || 1);
    }

    const paymentConfigResult = await query('SELECT shipping_cost, free_shipping_from, included_shipping_cost FROM payment_config LIMIT 1');
    const shippingCostConfig = paymentConfigResult.rows.length > 0 ? Number(paymentConfigResult.rows[0].shipping_cost || 0) : Number(shipping_cost || 0);
    const freeShippingFrom = paymentConfigResult.rows.length > 0 ? Number(paymentConfigResult.rows[0].free_shipping_from || 0) : 2000;
    const includedShippingCost = paymentConfigResult.rows.length > 0 ? Number(paymentConfigResult.rows[0].included_shipping_cost || 0) : 0;

    let calculatedShipping = 0;
    if (calculatedSubtotal < freeShippingFrom) {
      const provinceForLookup = shipping_province || shipping_city;
      if (provinceForLookup) {
        const rateResult = await query(
          'SELECT shipping_cost FROM shipping_rates_by_province WHERE province = $1',
          [provinceForLookup]
        );
        if (rateResult.rows.length > 0) {
          const provinceCost = Number(rateResult.rows[0].shipping_cost || 0);
          calculatedShipping = Math.max(0, provinceCost - includedShippingCost);
        } else {
          calculatedShipping = shippingCostConfig;
        }
      } else {
        calculatedShipping = shippingCostConfig;
      }
    }

    let couponDiscount = 0;
    let couponRow = null;
    const tenantId = req.tenantId || 'default';
    if (couponCode) {
      const couponResult = await query(
        'SELECT * FROM coupons WHERE code = $1 AND active = TRUE AND (tenant_id = $2 OR tenant_id = \'default\')',
        [String(couponCode).trim(), tenantId]
      );
      if (couponResult.rows.length > 0) {
        couponRow = couponResult.rows[0];
        if (couponRow.expires_at && new Date(couponRow.expires_at) < new Date()) {
          return res.status(400).json({ error: 'Cupón expirado' });
        }
        if (couponRow.max_uses > 0 && couponRow.used_count >= couponRow.max_uses) {
          return res.status(400).json({ error: 'Cupón agotado' });
        }
        if (calculatedSubtotal < Number(couponRow.min_amount || 0)) {
          return res.status(400).json({ error: 'Monto mínimo no alcanzado para este cupón' });
        }
        if (couponRow.type === 'percent') {
          couponDiscount = calculatedSubtotal * (Number(couponRow.value) / 100);
        } else {
          couponDiscount = Number(couponRow.value);
        }
        couponDiscount = Math.min(couponDiscount, calculatedSubtotal);
      } else {
        return res.status(400).json({ error: 'Cupón inválido' });
      }
    }

    const calculatedTotal = roundMoney(calculatedSubtotal - couponDiscount + calculatedShipping);

    if (Math.abs(calculatedTotal - Number(total)) > 0.01) {
      logger.warn({ frontendTotal: total, calculatedTotal }, 'createOrder: total del frontend no coincide con el calculado por el backend');
    }

    const result = await transaction(async (client) => {
      logger.info('createOrder: dentro de transaccion');
      await checkAndUpdateStock(validatedItems, tenantId, client);

      let finalCouponCode = couponCode ? String(couponCode).trim() : '';
      let finalCouponDiscount = 0;
      if (couponRow) {
        const lockedCoupon = await query(
          'SELECT * FROM coupons WHERE code = $1 AND (tenant_id = $2 OR tenant_id = \'default\') FOR UPDATE',
          [finalCouponCode, tenantId],
          client
        );
        if (lockedCoupon.rows.length === 0) {
          throw new Error('Cupón no encontrado');
        }
        const coupon = lockedCoupon.rows[0];
        if (coupon.expires_at && new Date(coupon.expires_at) < new Date()) {
          throw new Error('Cupón expirado');
        }
        if (coupon.max_uses > 0 && coupon.used_count >= coupon.max_uses) {
          throw new Error('Cupón agotado');
        }
        if (calculatedSubtotal < Number(coupon.min_amount || 0)) {
          throw new Error('Monto mínimo no alcanzado para este cupón');
        }
        if (coupon.type === 'percent') {
          finalCouponDiscount = calculatedSubtotal * (Number(coupon.value) / 100);
        } else {
          finalCouponDiscount = Number(coupon.value);
        }
        finalCouponDiscount = Math.min(finalCouponDiscount, calculatedSubtotal);

        await query(
          'UPDATE coupons SET used_count = used_count + 1 WHERE code = $1 AND (tenant_id = $2 OR tenant_id = \'default\')',
          [finalCouponCode, tenantId],
          client
        );
      }

      const finalTotal = roundMoney(calculatedSubtotal - finalCouponDiscount + calculatedShipping);

      const orderResult = await query(
        'INSERT INTO orders (items, total, customer, status, shipping_name, shipping_address, shipping_phone, shipping_zip, shipping_city, shipping_email, subtotal, shipping_cost, notes, order_token, coupon_code, coupon_discount, payment_method, tenant_id) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18) RETURNING *',
        [
          JSON.stringify(validatedItems),
          finalTotal,
          JSON.stringify(customerData),
          'pending',
          shipping_name || '',
          shipping_address || '',
          shipping_phone || '',
          shipping_zip || '',
          shipping_city || '',
          shipping_email || '',
          calculatedSubtotal,
          calculatedShipping,
          notes || '',
          orderToken,
          finalCouponCode,
          finalCouponDiscount,
          payment_method || 'transfer',
          tenantId
        ],
        client
      );

      return { ...orderResult.rows[0], order_token: orderToken };
    });

    logger.info({ orderId: result.id, total: calculatedTotal, itemsCount: validatedItems.length }, 'Orden creada');
    res.status(201).json(result);
    try { syncBus.emit('order_created', { id: result.id }); } catch (e) { /* noop */ }

    const customerEmail = shipping_email || (typeof customer === 'string' ? '' : customer?.email) || '';
    if (customerEmail) {
      sendOrderConfirmationEmail(result, customerEmail).catch(err => {
        logger.warn({ err: err.message, orderId: result.id }, 'No se pudo enviar email de confirmación');
      });
    }
  } catch (err) {
    logger.error({ err: err.message }, 'Error creando pedido');
    res.status(400).json({ error: err.message || 'Error interno del servidor' });
  }
}

async function updateOrderStatus(req, res) {
  const id = Number(req.params.id);
  const tenantId = req.tenantId || 'default';
  const { status, shipping_name, shipping_address, shipping_phone, shipping_zip, shipping_city, shipping_email, subtotal, shipping_cost, notes, payment_method } = req.body || {};
  const updates = {};
  const logMsgs = [];
  if (status !== undefined) {
    if (!VALID_STATUSES.includes(status)) {
      return res.status(400).json({ error: `Estado inválido. Estados válidos: ${VALID_STATUSES.join(', ')}` });
    }
    updates.status = status;
    logMsgs.push(`Estado cambiado a ${status}`);
  }
  if (shipping_name !== undefined) updates.shipping_name = shipping_name;
  if (shipping_address !== undefined) updates.shipping_address = shipping_address;
  if (shipping_phone !== undefined) updates.shipping_phone = shipping_phone;
  if (shipping_zip !== undefined) updates.shipping_zip = shipping_zip;
  if (shipping_city !== undefined) updates.shipping_city = shipping_city;
  if (shipping_email !== undefined) updates.shipping_email = shipping_email;
  if (subtotal !== undefined) updates.subtotal = Number(subtotal);
  if (shipping_cost !== undefined) updates.shipping_cost = Number(shipping_cost);
  if (payment_method !== undefined) updates.payment_method = payment_method;
  if (notes !== undefined) updates.notes = notes;

  const fields = Object.keys(updates);
  if (!fields.length) return res.status(400).json({ error: 'Sin datos para actualizar' });
  const values = fields.map(f => updates[f]);
  values.push(id, tenantId);
  const setClause = fields.map((_, i) => `${fields[i]} = $${i + 1}`).join(', ');

  try {
    if (status === 'cancelled') {
      await restoreStockOnCancellation(id, tenantId, null);
      logMsgs.push('Stock restaurado');
    }

    const result = await query(`UPDATE orders SET ${setClause} WHERE id = $${values.length - 1} AND deleted_at IS NULL AND (tenant_id = $${values.length} OR tenant_id = 'default') RETURNING *`, values);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Pedido no encontrado' });
    const user = req.user?.user || 'admin';
    await logActivity(user, 'update', 'order', id, logMsgs.join('; '), req.ip || '', id, req.headers['x-tenant-id'] || req.user?.tenant_id || 'default');
    res.json(result.rows[0]);
    try { syncBus.emit('order_status_updated', { id: Number(req.params.id), status: updates.status }); } catch (e) { /* noop */ }
  } catch (err) {
    logger.error({ err: err.message }, 'Error actualizando pedido');
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

async function deleteOrder(req, res) {
  const id = Number(req.params.id);
  const tenantId = req.tenantId || 'default';
  try {
    await transaction(async (client) => {
      const orderResult = await query('SELECT * FROM orders WHERE id = $1 AND deleted_at IS NULL AND (tenant_id = $2 OR tenant_id = \'default\')', [id, tenantId], client);
      if (orderResult.rows.length === 0) throw new Error('NOT_FOUND');
      const order = orderResult.rows[0];
      const items = safeJsonParse(order.items, []);
      if (order.status === 'pending' || order.status === 'confirmed' || order.status === 'cancelled') {
        await restoreStockForOrder(items, client, tenantId);
      }
      const user = req.user?.user || 'admin';
      await logActivity(user, 'archive', 'order', id, `Pedido #${id} archivado (borrado lógico)`, req.ip || '', id, req.headers['x-tenant-id'] || req.user?.tenant_id || 'default', client);
      await query('UPDATE orders SET deleted_at = CURRENT_TIMESTAMP WHERE id = $1 AND deleted_at IS NULL AND (tenant_id = $2 OR tenant_id = \'default\')', [id, tenantId], client);
    });
    await deleteOrderAttachments(id);
    res.json({ ok: true, archived: true });
  } catch (err) {
    if (err.message === 'NOT_FOUND') return res.status(404).json({ error: 'Pedido no encontrado' });
    logger.error({ err: err.message }, 'Error eliminando pedido');
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

async function batchDeleteOrders(req, res) {
  const { status } = req.body || {};
  const tenantId = req.tenantId || 'default';
  if (!status || !VALID_STATUSES.includes(status)) {
    return res.status(400).json({ error: 'Estado inválido para eliminación en lote' });
  }
  try {
    const result = await transaction(async (client) => {
      const orders = await restoreStockOnBatchDelete(status, tenantId, client);
      for (const order of orders) {
        const user = req.user?.user || 'admin';
        await logActivity(user, 'batch_archive', 'order', order.id, `Pedido #${order.id} archivado en lote (estado: ${status})`, req.ip || '', order.id, req.headers['x-tenant-id'] || req.user?.tenant_id || 'default', client);
      }
      const deleteResult = await query('UPDATE orders SET deleted_at = CURRENT_TIMESTAMP WHERE status = $1 AND deleted_at IS NULL AND (tenant_id = $2 OR tenant_id = \'default\')', [status, tenantId], client);
      return { deleted: deleteResult.rowCount, archived: true, ids: orders.map(o => o.id) };
    });
    for (const oid of (result.ids || [])) {
      await deleteOrderAttachments(oid);
    }
    res.json({ ok: true, deleted: result.deleted });
  } catch (err) {
    logger.error({ err: err.message }, 'Error eliminando pedidos en lote');
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

async function updateOrderNotes(req, res) {
  const id = Number(req.params.id);
  const tenantId = req.tenantId || 'default';
  const { notes } = req.body || {};
  try {
    const result = await query(
      'UPDATE orders SET notes = $1 WHERE id = $2 AND deleted_at IS NULL AND (tenant_id = $3 OR tenant_id = \'default\') RETURNING *',
      [notes || '', id, tenantId]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Pedido no encontrado' });
    const user = req.user?.user || 'admin';
    await logActivity(user, 'update_notes', 'order', id, 'Nota interna actualizada', req.ip || '', id, req.headers['x-tenant-id'] || req.user?.tenant_id || 'default');
    res.json(result.rows[0]);
  } catch (err) {
    logger.error('Error actualizando nota del pedido:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

async function updateOrder(req, res) {
  const id = Number(req.params.id);
  const tenantId = req.tenantId || 'default';
  const {
    shipping_name, shipping_address, shipping_phone, shipping_zip,
    shipping_city, shipping_email, notes, subtotal, shipping_cost,
    payment_method, status
  } = req.body || {};

  const updates = {};
  const logMsgs = [];
  if (status !== undefined && VALID_STATUSES.includes(status)) {
    updates.status = status;
    logMsgs.push('Estado cambiado a ' + status);
  }
  if (shipping_name !== undefined) updates.shipping_name = shipping_name;
  if (shipping_address !== undefined) updates.shipping_address = shipping_address;
  if (shipping_phone !== undefined) updates.shipping_phone = shipping_phone;
  if (shipping_zip !== undefined) updates.shipping_zip = shipping_zip;
  if (shipping_city !== undefined) updates.shipping_city = shipping_city;
  if (shipping_email !== undefined) updates.shipping_email = shipping_email;
  if (notes !== undefined) updates.notes = notes;
  if (subtotal !== undefined) updates.subtotal = Number(subtotal);
  if (shipping_cost !== undefined) updates.shipping_cost = Number(shipping_cost);
  if (payment_method !== undefined) updates.payment_method = payment_method;

  const fields = Object.keys(updates);
  if (!fields.length) return res.status(400).json({ error: 'Sin datos para actualizar' });

  const values = fields.map(f => updates[f]);
  values.push(id, tenantId);
  const setClause = fields.map((_, i) => `${fields[i]} = $${i + 1}`).join(', ');

  try {
    if (status === 'cancelled') {
      await restoreStockOnCancellation(id, tenantId, null);
      logMsgs.push('Stock restaurado');
    }

    const result = await query(`UPDATE orders SET ${setClause} WHERE id = $${values.length - 1} AND deleted_at IS NULL AND (tenant_id = $${values.length} OR tenant_id = 'default') RETURNING *`, values);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Pedido no encontrado' });
    const user = req.user?.user || 'admin';
    await logActivity(user, 'update', 'order', id, logMsgs.join('; '), req.ip || '', id, req.headers['x-tenant-id'] || req.user?.tenant_id || 'default');
    res.json(result.rows[0]);
    try { syncBus.emit('order_status_updated', { id: Number(req.params.id), status: updates.status }); } catch (e) { /* noop */ }
  } catch (err) {
    logger.error({ err: err.message }, 'Error actualizando pedido');
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

module.exports = { createOrder, updateOrderStatus, deleteOrder, batchDeleteOrders, updateOrderNotes, updateOrder, deleteOrderAttachments };