const crypto = require('crypto');
const { query, transaction } = require('../lib/db');
const logger = require('../lib/logger');
const { orderSchema } = require('../lib/validators');
const { syncBus } = require('../routes/sync');
const { safeJsonParse } = require('../lib/parser');
const path = require('path');
const fs = require('fs');
const PDFDocument = require('pdfkit');
const { sendOrderConfirmationEmail } = require('../lib/email');

async function logActivity(user, action, entityType = '', entityId = 0, details = '', ip = '', relatedOrderId = 0, tenantId = 'default') {
  try {
    await query(
      'INSERT INTO activity_log (username, action, entity_type, entity_id, details, ip, related_order_id, tenant_id) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
      [user, action, entityType, entityId, details, ip, relatedOrderId, tenantId]
    );
  } catch (err) {
    logger.warn({ err: err.message }, 'Error guardando activity_log');
  }
}

const VALID_STATUSES = ['pending', 'confirmed', 'preparing', 'shipped', 'delivered', 'cancelled'];

const getOrders = async (req, res) => {
  try {
    const { status, start_date, end_date, page, limit, q } = req.query;
    let where = 'WHERE TRUE';
    const params = [];

    if (status) { params.push(status); where += ` AND status = $${params.length}`; }
    if (start_date) { params.push(start_date); where += ` AND date(created_at) >= $${params.length}`; }
    if (end_date) { params.push(end_date); where += ` AND date(created_at) <= $${params.length}`; }
    if (q) {
      params.push(`%${q}%`);
      where += ` AND (customer->>'name' ILIKE $${params.length} OR CAST(id AS TEXT) LIKE $${params.length})`;
    }

    const pageNum = Number(page) || 1;
    const limitNum = Number(limit) || 30;
    const offset = (pageNum - 1) * limitNum;

    const countResult = await query(`SELECT COUNT(*) as total FROM orders ${where}`, params);
    const total = Number(countResult.rows[0]?.total || 0);

    params.push(limitNum, offset);
    const result = await query(
      `SELECT * FROM orders ${where} ORDER BY created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );

    res.json({
      orders: result.rows,
      total,
      page: pageNum,
      pages: Math.ceil(total / limitNum),
      hasMore: pageNum * limitNum < total
    });
  } catch (err) {
    logger.error({ err: err.message }, 'Error obteniendo pedidos');
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

const getUserOrders = async (req, res) => {
  try {
    const { email } = req.query;
    if (!email) {
      return res.status(400).json({ error: 'Email es requerido para buscar pedidos' });
    }
    const result = await query('SELECT * FROM orders WHERE shipping_email = $1 ORDER BY created_at DESC', [email]);
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
    res.json(result.rows);
  } catch (err) {
    logger.error({ err: err.message }, 'Error obteniendo tus pedidos');
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

const createOrder = async (req, res) => {
  logger.info('createOrder: inicio');
  const { items, total, customer, shipping_name, shipping_address, shipping_phone, shipping_zip, shipping_city, shipping_email, shipping_cost, notes, idempotency_key, couponCode } = req.body || {};
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
      calculatedSubtotal += dbPrice * Number(item.quantity || 1);
    }

    const paymentConfigResult = await query('SELECT shipping_cost, free_shipping_from FROM payment_config LIMIT 1');
    const shippingCostConfig = paymentConfigResult.rows.length > 0 ? Number(paymentConfigResult.rows[0].shipping_cost || 0) : Number(shipping_cost || 0);
    const freeShippingFrom = paymentConfigResult.rows.length > 0 ? Number(paymentConfigResult.rows[0].free_shipping_from || 0) : 2000;
    const calculatedShipping = calculatedSubtotal >= freeShippingFrom ? 0 : shippingCostConfig;

    let couponDiscount = 0;
    let couponRow = null;
    if (couponCode) {
      const couponResult = await query(
        'SELECT * FROM coupons WHERE code = $1 AND active = TRUE AND (tenant_id = current_setting(\'app.current_tenant\', TRUE) OR tenant_id = \'default\')',
        [String(couponCode).trim()]
      );
      if (couponResult.rows.length > 0) {
        couponRow = couponResult.rows[0];
      } else {
        return res.status(400).json({ error: 'Cupón inválido' });
      }
    }

    const calculatedTotal = calculatedSubtotal - couponDiscount + calculatedShipping;

    if (Math.abs(calculatedTotal - Number(total)) > 0.01) {
      logger.warn({ frontendTotal: total, calculatedTotal }, 'createOrder: total del frontend no coincide con el calculado por el backend');
    }

    const result = await transaction(async (client) => {
      logger.info('createOrder: dentro de transaccion');
      for (const item of validatedItems) {
        logger.info('createOrder: consultando stock para producto', { itemId: item.id });
        const stockResult = await query('SELECT stock FROM products WHERE id = $1', [Number(item.id)], client);
        if (stockResult.rows.length === 0) {
          throw new Error(`Producto ${item.id} no encontrado`);
        }
        const currentStock = stockResult.rows[0].stock;
        if (currentStock < item.quantity) {
          throw new Error(`Stock insuficiente para el producto ${item.id}. Disponible: ${currentStock}, solicitado: ${item.quantity}`);
        }
        await query(
          'UPDATE products SET stock = stock - $1 WHERE id = $2',
          [Number(item.quantity), Number(item.id)],
          client
        );
      }

      let finalCouponCode = couponCode ? String(couponCode).trim() : '';
      let finalCouponDiscount = 0;
      if (couponRow) {
        const lockedCoupon = await query(
          'SELECT * FROM coupons WHERE code = $1 AND (tenant_id = current_setting(\'app.current_tenant\', TRUE) OR tenant_id = \'default\') FOR UPDATE',
          [finalCouponCode],
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
          'UPDATE coupons SET used_count = used_count + 1 WHERE code = $1',
          [finalCouponCode],
          client
        );
      }

      const finalTotal = calculatedSubtotal - finalCouponDiscount + calculatedShipping;

      const orderResult = await query(
        'INSERT INTO orders (items, total, customer, status, shipping_name, shipping_address, shipping_phone, shipping_zip, shipping_city, shipping_email, subtotal, shipping_cost, notes, order_token, coupon_code, coupon_discount, tenant_id) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, COALESCE(current_setting(\'app.current_tenant\', TRUE), \'default\')) RETURNING *',
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
          finalCouponDiscount
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
};

async function restoreStockForOrder(items) {
  const itemsArr = typeof items === 'string' ? JSON.parse(items) : items;
  if (!Array.isArray(itemsArr)) return;
  for (const item of itemsArr) {
    const productId = Number(item.id);
    const qty = Number(item.quantity || 1);
    await query('UPDATE products SET stock = stock + $1 WHERE id = $2', [qty, productId]);
  }
}

const updateOrderStatus = async (req, res) => {
  const id = Number(req.params.id);
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
  values.push(id);
  const setClause = fields.map((_, i) => `${fields[i]} = $${i + 1}`).join(', ');

  try {
    if (status === 'cancelled') {
      const existing = await query('SELECT items, status FROM orders WHERE id = $1', [id]);
      if (existing.rows.length > 0 && existing.rows[0].status !== 'cancelled') {
        await restoreStockForOrder(existing.rows[0].items);
        logMsgs.push('Stock restaurado');
      }
    }

    const result = await query(`UPDATE orders SET ${setClause} WHERE id = $${values.length} RETURNING *`, values);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Pedido no encontrado' });
    const user = req.user?.user || 'admin';
    await logActivity(user, 'update', 'order', id, logMsgs.join('; '), req.ip || '', id, req.headers['x-tenant-id'] || req.user?.tenant_id || 'default');
    res.json(result.rows[0]);
    try { syncBus.emit('order_status_updated', { id: Number(req.params.id), status: updates.status }); } catch (e) { /* noop */ }
  } catch (err) {
    logger.error({ err: err.message }, 'Error actualizando pedido');
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

const deleteOrder = async (req, res) => {
  const id = Number(req.params.id);
  try {
    const orderResult = await query('SELECT * FROM orders WHERE id = $1', [id]);
    if (orderResult.rows.length === 0) return res.status(404).json({ error: 'Pedido no encontrado' });
    const order = orderResult.rows[0];
    const items = safeJsonParse(order.items, []);
    if (order.status === 'pending' || order.status === 'confirmed' || order.status === 'cancelled') {
      await restoreStockForOrder(items);
    }
    const user = req.user?.user || 'admin';
    await logActivity(user, 'delete', 'order', id, `Pedido #${id} eliminado`, req.ip || '', id, req.headers['x-tenant-id'] || req.user?.tenant_id || 'default');
    await query('DELETE FROM orders WHERE id = $1', [id]);
    res.json({ ok: true });
  } catch (err) {
    logger.error({ err: err.message }, 'Error eliminando pedido');
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

// Bulk delete removido del flujo público/admin
// const deleteMultipleOrders = async (req, res) => {
//   const ids = (req.body.ids || []).map(Number).filter(Boolean);
//   if (!ids.length) return res.status(400).json({ error: 'No se proporcionaron IDs de pedidos' });
//   try {
//     const results = { deleted: 0, errors: [] };
//     for (const id of ids) {
//       try {
//         const orderResult = await query('SELECT * FROM orders WHERE id = $1', [id]);
//         if (orderResult.rows.length === 0) {
//           results.errors.push(`Pedido #${id} no encontrado`);
//           continue;
//         }
//         const order = orderResult.rows[0];
//         const items = typeof order.items === 'string' ? JSON.parse(order.items) : order.items;
//         if (order.status === 'pending' || order.status === 'confirmed' || order.status === 'cancelled') {
//           await restoreStockForOrder(items);
//         }
//         const user = req.user?.user || 'admin';
//         await logActivity(user, 'delete', 'order', id, `Pedido #${id} eliminado (bulk)`, req.ip || '');
//         await query('DELETE FROM orders WHERE id = $1', [id]);
//         results.deleted++;
//       } catch (err) {
//         results.errors.push(`Error eliminando pedido #${id}: ${err.message}`);
//       }
//     }
//     res.json(results);
//   } catch (err) {
//     logger.error({ err: err.message }, 'Error en eliminación masiva de pedidos');
//     res.status(500).json({ error: 'Error interno del servidor' });
//   }
// };

const updateOrderNotes = async (req, res) => {
  const id = Number(req.params.id);
  const { notes } = req.body || {};
  try {
    const result = await query(
      'UPDATE orders SET notes = $1 WHERE id = $2 RETURNING *',
      [notes || '', id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Pedido no encontrado' });
    const user = req.user?.user || 'admin';
    await logActivity(user, 'update_notes', 'order', id, 'Nota interna actualizada', req.ip || '', id, req.headers['x-tenant-id'] || req.user?.tenant_id || 'default');
    res.json(result.rows[0]);
  } catch (err) {
    logger.error('Error actualizando nota del pedido:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

const getOrderReceipt = async (req, res) => {
  const orderId = Number(req.params.id);
  try {
    const result = await query('SELECT * FROM receipts WHERE order_id = $1', [orderId]);
    if (result.rows.length === 0) return res.json({});
    res.json(result.rows[0]);
  } catch (err) {
    logger.error({ err: err.message }, 'Error obteniendo receipt');
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

const getOrderDetail = async (req, res) => {
  const id = Number(req.params.id);
  try {
    const result = await query('SELECT * FROM orders WHERE id = $1', [id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Pedido no encontrado' });
    res.json(result.rows[0]);
  } catch (err) {
    logger.error({ err: err.message }, 'Error obteniendo detalle del pedido');
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

const addOrderActivity = async (req, res) => {
  const orderId = Number(req.params.id);
  const { action, details } = req.body || {};
  if (!action) return res.status(400).json({ error: 'Acción requerida' });
  try {
    const user = req.user?.user || 'admin';
    await logActivity(user, action, 'order', orderId, details || '', req.ip || '', orderId, req.headers['x-tenant-id'] || req.user?.tenant_id || 'default');
    res.json({ ok: true });
  } catch (err) {
    logger.error({ err: err.message }, 'Error agregando actividad del pedido');
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

const getOrderActivities = async (req, res) => {
  const orderId = Number(req.params.id);
  try {
    const result = await query('SELECT * FROM activity_log WHERE related_order_id = $1 ORDER BY created_at ASC', [orderId]);
    res.json({ activities: result.rows });
  } catch (err) {
    logger.error({ err: err.message }, 'Error obteniendo actividad del pedido');
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

const exportOrders = async (req, res) => {
  const { format = 'csv' } = req.query;
  try {
    const { status, start_date, end_date, q } = req.query;
    let where = 'WHERE TRUE';
    const params = [];

    if (status) { params.push(status); where += ` AND status = $${params.length}`; }
    if (start_date) { params.push(start_date); where += ` AND date(created_at) >= $${params.length}`; }
    if (end_date) { params.push(end_date); where += ` AND date(created_at) <= $${params.length}`; }
    if (q) { params.push(`%${q}%`); where += ` AND (customer->>'name' ILIKE $${params.length} OR customer->>'email' ILIKE $${params.length})`; }

    const result = await query(`SELECT * FROM orders ${where} ORDER BY created_at DESC`, params);

    if (format === 'pdf') {
      const filepath = path.join(__dirname, '..', '..', 'uploads', 'receipts', `pedidos-export-${Date.now()}.pdf`);
      if (!fs.existsSync(path.dirname(filepath))) fs.mkdirSync(path.dirname(filepath), { recursive: true });
      const doc = new PDFDocument({ size: 'A4', margin: 50 });
      const stream = fs.createWriteStream(filepath);
      doc.pipe(stream);

      doc.fontSize(16).font('Helvetica-Bold').text('Reporte de Pedidos - Artesanía Gualeguay');
      doc.moveDown();
      doc.fontSize(10).font('Helvetica').text(`Total: ${result.rows.length} pedidos`);
      doc.moveDown();

      result.rows.forEach(o => {
        const customer = safeJsonParse(o.customer, {});
        const items = safeJsonParse(o.items, []);
        doc.font('Helvetica-Bold').text(`Pedido #${o.id}`, { underline: true });
        doc.font('Helvetica').text(`Cliente: ${customer?.name || '—'} | Email: ${customer?.email || '—'} | Total: $${Number(o.total).toLocaleString('es-AR')} | Estado: ${o.status}`);
        doc.text(`Items: ${items.map(i => `${i.name || 'Producto'} x${i.quantity || 1}`).join(', ')}`);
        doc.text(`Fecha: ${new Date(o.created_at).toLocaleString('es-AR')}`);
        doc.moveDown();
      });

      doc.end();
      stream.on('finish', () => {
        res.download(filepath, `pedidos-${Date.now()}.pdf`, () => {
          if (fs.existsSync(filepath)) fs.unlinkSync(filepath);
        });
      });
      return;
    }

    const lines = ['ID,Cliente,Número,Email,Teléfono,Total,Estado,Pago,Fecha'];
    result.rows.forEach(o => {
      const customer = typeof o.customer === 'string' ? JSON.parse(o.customer) : (o.customer || {});
      const escape = v => `"${String(v || '').replace(/"/g, '""')}"`;
      lines.push([
        o.id,
        escape(customer?.name || ''),
        escape(customer?.phone || ''),
        escape(customer?.email || ''),
        escape(o.payment_method || ''),
        Number(o.total).toLocaleString('es-AR'),
        o.status || 'pending',
        new Date(o.created_at).toISOString().split('T')[0]
      ].join(','));
    });

    const csv = lines.join('\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename=pedidos-${Date.now()}.csv`);
    res.send(csv);
  } catch (err) {
    logger.error('Error exportando pedidos:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

const getPublicOrderTrack = async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ error: 'ID de pedido requerido' });
    const result = await query('SELECT id, items, total, status, shipping_name, shipping_address, shipping_phone, shipping_zip, shipping_city, shipping_email, created_at FROM orders WHERE id = $1', [id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Pedido no encontrado' });
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
    res.json(result.rows[0]);
  } catch (err) {
    logger.error({ err: err.message }, 'Error obteniendo pedido público');
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

module.exports = { getOrders, getUserOrders, createOrder, updateOrderStatus, deleteOrder, updateOrderNotes, getOrderDetail, exportOrders, addOrderActivity, getOrderReceipt, getOrderActivities, getPublicOrderTrack };
