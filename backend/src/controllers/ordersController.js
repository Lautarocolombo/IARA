const { query, transaction, connectionString: isPostgres } = require('../lib/db');
const logger = require('../lib/logger');
const { orderSchema } = require('../lib/validators');
const { syncBus } = require('../routes/sync');
const path = require('path');
const fs = require('fs');
const PDFDocument = require('pdfkit');
const { calculateShipping } = require('../lib/shipping');

async function logActivity(user, action, entityType = '', entityId = 0, details = '', ip = '') {
  try {
    await query(
      'INSERT INTO activity_log (username, action, entity_type, entity_id, details, ip) VALUES ($1, $2, $3, $4, $5, $6)',
      [user, action, entityType, entityId, details, ip]
    );
  } catch (err) {
    logger.warn({ err: err.message }, 'Error guardando activity_log');
  }
}

const VALID_STATUSES = ['pending', 'awaiting_verification', 'confirmed', 'preparing', 'shipped', 'delivered', 'cancelled', 'rejected', 'expired'];
const TRANSFER_RESERVATION_MINUTES = parseInt(process.env.TRANSFER_RESERVATION_MINUTES || '45', 10);

const VALID_TRANSITIONS = {
  'pending': ['awaiting_verification', 'cancelled', 'expired'],
  'awaiting_verification': ['confirmed', 'rejected', 'cancelled', 'expired'],
  'confirmed': ['preparing', 'shipped', 'delivered', 'cancelled'],
  'preparing': ['shipped', 'delivered', 'cancelled'],
  'shipped': ['delivered', 'cancelled'],
  'delivered': [],
  'cancelled': [],
  'rejected': [],
  'expired': []
};

const getOrders = async (req, res) => {
  try {
    const { status, start_date, end_date, page, limit } = req.query;
    let where = 'WHERE TRUE';
    const params = [];

    if (status) { params.push(status); where += ` AND status = $${params.length}`; }
    if (start_date) { params.push(start_date); where += ` AND date(created_at) >= $${params.length}`; }
    if (end_date) { params.push(end_date); where += ` AND date(created_at) <= $${params.length}`; }

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
  const { items, total, customer, shipping_name, shipping_address, shipping_phone, shipping_zip, shipping_city, shipping_province, shipping_email, subtotal, shipping_cost, notes, payment_method } = req.body || {};
  logger.info('createOrder: body parseado');

  const validation = orderSchema.safeParse({ items, total, customer, shipping_name, shipping_address, shipping_phone, shipping_zip, shipping_city, shipping_province, shipping_email, subtotal, shipping_cost });
  if (!validation.success) {
    logger.info('createOrder: validacion fallida');
    return res.status(400).json({ error: validation.error.issues[0]?.message || 'Datos inválidos' });
  }

  const validatedItems = validation.data.items;

  if (!validatedItems || !validatedItems.length || !total) {
    logger.info('createOrder: items/total faltantes');
    return res.status(400).json({ error: 'Items y total son requeridos' });
  }

  const effectivePaymentMethod = payment_method || 'transfer';
  const serverSubtotal = validatedItems.reduce((sum, i) => sum + (Number(i.price) * Number(i.quantity || i.qty || 1)), 0);
  const shippingResult = calculateShipping(shipping_province, shipping_zip, serverSubtotal);
  const serverShippingCost = Number(shipping_cost) === shippingResult.cost ? shippingResult.cost : shippingResult.cost;
  const serverTotal = serverSubtotal + serverShippingCost;

  if (Math.abs(serverTotal - Number(total)) > 0.01) {
    return res.status(400).json({ error: `El total no coincide. Calculado: ${serverTotal}, recibido: ${total}` });
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

    const result = await transaction(async (client) => {
      logger.info('createOrder: dentro de transaccion', { paymentMethod: effectivePaymentMethod });

      const stockQuery = isPostgres
        ? 'SELECT stock FROM products WHERE id = $1 FOR UPDATE'
        : 'SELECT stock FROM products WHERE id = $1';

      if (effectivePaymentMethod === 'transfer') {
        for (const item of validatedItems) {
          const stockResult = await query(stockQuery, [Number(item.id)], client);
          if (stockResult.rows.length === 0) {
            throw new Error(`Producto ${item.id} no encontrado`);
          }
          const currentStock = stockResult.rows[0].stock;
          if (currentStock < item.quantity) {
            throw new Error(`Stock insuficiente para el producto ${item.id}. Disponible: ${currentStock}, solicitado: ${item.quantity}`);
          }
        }
      } else {
        for (const item of validatedItems) {
          logger.info('createOrder: consultando stock para producto', { itemId: item.id });
          const stockResult = await query(stockQuery, [Number(item.id)], client);
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
      }

      const orderStatus = effectivePaymentMethod === 'transfer' ? 'pending' : 'pending';
      const paymentStatus = effectivePaymentMethod === 'transfer' ? 'pending' : 'pending';
      const reservedUntil = effectivePaymentMethod === 'transfer'
        ? new Date(Date.now() + TRANSFER_RESERVATION_MINUTES * 60 * 1000).toISOString()
        : null;

      const orderResult = await query(
        'INSERT INTO orders (items, total, customer, status, notes, shipping_name, shipping_address, shipping_phone, shipping_zip, shipping_city, shipping_province, shipping_email, subtotal, shipping_cost, payment_method, payment_status, reserved_until, transfer_amount_paid) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18) RETURNING *',
        [
          JSON.stringify(validatedItems),
          Number(serverTotal),
          JSON.stringify(customerData),
          orderStatus,
          notes || '',
          shipping_name || '',
          shipping_address || '',
          shipping_phone || '',
          shipping_zip || '',
          shipping_city || '',
          shipping_province || '',
          shipping_email || '',
          Number(serverSubtotal),
          Number(serverShippingCost),
          effectivePaymentMethod,
          paymentStatus,
          reservedUntil,
          0
        ],
        client
      );

      return orderResult.rows[0];
    });

    const waMessage = buildWhatsAppMessage(result, validatedItems, serverShippingCost, shippingResult, effectivePaymentMethod);
    const waNumber = (process.env.WHATSAPP || '+5493444634444').replace(/[^\d]/g, '');

    logger.info({ orderId: result.id, total: serverTotal, itemsCount: validatedItems.length, paymentMethod: effectivePaymentMethod }, 'Orden creada');
    res.status(201).json({
      ...result,
      waMessage,
      waNumber,
      shippingCost: serverShippingCost,
      subtotal: serverSubtotal,
      shippingProvince: shipping_province || '',
      freeShipping: shippingResult.freeShipping,
      paymentMethod: effectivePaymentMethod,
      reservedUntil: result.reserved_until || null
    });
    try { syncBus.emit('order_created', { id: result.id }); } catch (e) { /* noop */ }
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
    const existing = await query('SELECT status, items, payment_method FROM orders WHERE id = $1', [id]);
    if (existing.rows.length === 0) return res.status(404).json({ error: 'Pedido no encontrado' });
    const currentStatus = existing.rows[0].status;

    if (status !== undefined && status !== currentStatus) {
      const allowed = VALID_TRANSITIONS[currentStatus] || [];
      if (!allowed.includes(status)) {
        return res.status(400).json({ error: `No se puede cambiar de "${currentStatus}" a "${status}". Transiciones válidas: ${allowed.join(', ') || 'ninguna'}` });
      }
    }

    if (status === 'cancelled') {
      if (existing.rows[0].status !== 'cancelled') {
        await restoreStockForOrder(existing.rows[0].items);
        logMsgs.push('Stock restaurado');
      }
    }

    if (status === 'confirmed' && existing.rows[0].payment_method === 'transfer' && existing.rows[0].status !== 'confirmed') {
      const stockCheck = await query('SELECT id, stock FROM products');
      const items = typeof existing.rows[0].items === 'string' ? JSON.parse(existing.rows[0].items) : existing.rows[0].items;
      for (const item of items) {
        const product = stockCheck.rows.find(p => p.id === Number(item.id));
        if (!product || product.stock < item.quantity) {
          return res.status(400).json({ error: `Stock insuficiente para confirmar. Producto ${item.name || item.id}: disponible ${product?.stock || 0}, requerido ${item.quantity}` });
        }
      }
    }

    const result = await query(`UPDATE orders SET ${setClause} WHERE id = $${values.length} RETURNING *`, values);
    const user = req.user?.user || 'admin';
    await logActivity(user, 'update', 'order', id, logMsgs.join('; '), req.ip || '');
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
    const items = typeof order.items === 'string' ? JSON.parse(order.items) : order.items;
    if (order.status === 'pending' || order.status === 'confirmed' || order.status === 'cancelled') {
      await restoreStockForOrder(items);
    }
    const user = req.user?.user || 'admin';
    await logActivity(user, 'delete', 'order', id, `Pedido #${id} eliminado`, req.ip || '');
    await query('DELETE FROM orders WHERE id = $1', [id]);
    res.json({ ok: true });
  } catch (err) {
    logger.error({ err: err.message }, 'Error eliminando pedido');
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

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
    await logActivity(user, 'update_notes', 'order', id, 'Nota interna actualizada', req.ip || '');
    res.json(result.rows[0]);
  } catch (err) {
    logger.error('Error actualizando nota del pedido:', err);
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
        const customer = typeof o.customer === 'string' ? JSON.parse(o.customer) : (o.customer || {});
        const items = typeof o.items === 'string' ? JSON.parse(o.items) : (o.items || []);
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

function buildWhatsAppMessage(order, items, shippingCost, shippingResult, paymentMethod) {
  const customer = typeof order.customer === 'string' ? JSON.parse(order.customer) : (order.customer || {});
  const orderNumber = `#${String(order.id).padStart(4, '0')}`;
  const lines = [
    `Hola! Quiero confirmar el pago de mi pedido ${orderNumber}:`,
    ``,
    `Datos del cliente:`,
    `Nombre: ${customer.name || order.shipping_name || 'No especificado'}`,
    `Dirección: ${customer.address || order.shipping_address || 'No especificada'}`,
    `Localidad: ${customer.city || order.shipping_city || 'No especificada'}`,
    `Provincia: ${customer.province || order.shipping_province || 'No especificada'}`,
    `Código postal: ${customer.zip || order.shipping_zip || 'No especificado'}`,
    `Teléfono: ${customer.phone || order.shipping_phone || 'No especificado'}`,
    `Email: ${customer.email || order.shipping_email || 'No especificado'}`,
    ``,
    `Productos:`
  ];

  items.forEach((it, idx) => {
    lines.push(`${idx + 1}. ${it.name || 'Producto'} x${it.quantity || it.qty || 1} — $${Number(it.price || 0).toLocaleString('es-AR')}`);
  });

  lines.push(``);
  lines.push(`Subtotal: $${Number(order.subtotal || 0).toLocaleString('es-AR')}`);
  lines.push(`Envío a ${shippingResult.province}: $${Number(shippingCost).toLocaleString('es-AR')}`);
  if (shippingResult.freeShipping) {
    lines.push(`Envío GRATIS (superó el mínimo de $${shippingResult.freeFrom.toLocaleString('es-AR')})`);
  }
  lines.push(`Total: $${Number(order.total).toLocaleString('es-AR')}`);
  lines.push(``);
  if (paymentMethod === 'transfer') {
    lines.push(`Te envío el comprobante de pago por transferencia.`);
  } else {
    lines.push(`Te envío el comprobante de pago por MercadoPago al alias configurado.`);
  }

  return encodeURIComponent(lines.join('\n'));
}

async function expireTransferReservations() {
  try {
    const result = await query(
      `SELECT id, items, payment_method FROM orders WHERE status = 'pending' AND payment_method = 'transfer' AND reserved_until IS NOT NULL AND reserved_until < CURRENT_TIMESTAMP`
    );
    for (const order of result.rows) {
      try {
        await query("UPDATE orders SET status = 'expired', payment_status = 'expired' WHERE id = $1", [order.id]);
        logger.info({ orderId: order.id }, 'Reserva de transferencia expirada');
      } catch (err) {
        logger.error({ err: err.message, orderId: order.id }, 'Error expirando reserva');
      }
    }
  } catch (err) {
    logger.error({ err: err.message }, 'Error en expireTransferReservations');
  }
}

const getDashboardMetrics = async (req, res) => {
  try {
    const ordersResult = await query("SELECT COUNT(*) as total_orders, COALESCE(SUM(total), 0) as total_revenue FROM orders");
    const productsResult = await query("SELECT COUNT(*) as total_products FROM products WHERE deleted = FALSE");
    const totalOrders = Number(ordersResult.rows[0]?.total_orders || 0);
    const totalRevenue = Number(ordersResult.rows[0]?.total_revenue || 0);
    const totalProducts = Number(productsResult.rows[0]?.total_products || 0);
    res.json({
      totalOrders,
      totalRevenue,
      averageTicket: totalOrders > 0 ? totalRevenue / totalOrders : 0,
      totalProducts
    });
  } catch (err) {
    logger.error('Error obteniendo métricas de dashboard:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

module.exports = { getOrders, getUserOrders, createOrder, updateOrderStatus, deleteOrder, updateOrderNotes, getOrderDetail, exportOrders, buildWhatsAppMessage, expireTransferReservations, getDashboardMetrics };
