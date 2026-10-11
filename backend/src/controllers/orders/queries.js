const { query } = require('../../lib/db');
const logger = require('../../lib/logger');
const { safeJsonParse } = require('../../lib/parser');

async function getOrders(req, res) {
  try {
    const { status, start_date, end_date, page, limit, q } = req.query;
    const tenantId = req.tenantId || 'default';
    let where = 'WHERE (tenant_id = $1 OR tenant_id = \'default\') AND deleted_at IS NULL';
    const params = [tenantId];

    if (status) { params.push(status); where += ` AND status = $${params.length}`; }
    if (start_date) { params.push(start_date); where += ` AND date(created_at) >= $${params.length}`; }
    if (end_date) { params.push(end_date); where += ` AND date(created_at) <= $${params.length}`; }
    if (q) {
      params.push(`%${q}%`);
      where += ` AND (customer->>'name' ILIKE $${params.length} OR CAST(id AS TEXT) LIKE $${params.length})`;
    }

    const pageNum = Math.max(Number(page) || 1, 1);
    const limitNum = Math.min(Math.max(Number(limit) || 30, 1), 100);
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
    logger.error({ err: err.message, stack: err.stack }, 'Error obteniendo pedidos');
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

async function getUserOrders(req, res) {
  try {
    const { email, order_token } = req.query;
    if (!email) {
      return res.status(400).json({ error: 'Email es requerido para buscar pedidos' });
    }
    const tenantId = req.tenantId || 'default';
    const params = [email, tenantId];
    let whereClause = 'WHERE shipping_email = $1 AND (tenant_id = $2 OR tenant_id = \'default\')';
    if (order_token) {
      params.push(String(order_token));
      whereClause += ` AND order_token = $${params.length}`;
    }
    const result = await query(
      `SELECT * FROM orders ${whereClause} ORDER BY created_at DESC`,
      params
    );
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
    res.json(result.rows);
  } catch (err) {
    logger.error({ err: err.message }, 'Error obteniendo tus pedidos');
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

async function getOrderDetail(req, res) {
  const id = Number(req.params.id);
  const tenantId = req.tenantId || 'default';
  try {
    const result = await query('SELECT * FROM orders WHERE id = $1 AND deleted_at IS NULL AND (tenant_id = $2 OR tenant_id = \'default\')', [id, tenantId]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Pedido no encontrado' });
    res.json(result.rows[0]);
  } catch (err) {
    logger.error({ err: err.message }, 'Error obteniendo detalle del pedido');
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

async function getOrderReceipt(req, res) {
  const orderId = Number(req.params.id);
  const tenantId = req.tenantId || 'default';
  try {
    const result = await query('SELECT r.* FROM receipts r JOIN orders o ON r.order_id = o.id WHERE r.order_id = $1 AND (o.tenant_id = $2 OR o.tenant_id = \'default\')', [orderId, tenantId]);
    if (result.rows.length === 0) return res.json({});
    res.json(result.rows[0]);
  } catch (err) {
    logger.error({ err: err.message }, 'Error obteniendo receipt');
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

async function getOrderActivities(req, res) {
  const orderId = Number(req.params.id);
  try {
    const result = await query('SELECT * FROM activity_log WHERE related_order_id = $1 ORDER BY created_at ASC', [orderId]);
    res.json({ activities: result.rows });
  } catch (err) {
    logger.error({ err: err.message }, 'Error obteniendo actividad del pedido');
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

async function getPublicOrderTrack(req, res) {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ error: 'ID de pedido requerido' });
    const result = await query('SELECT id, items, total, status, shipping_name, shipping_address, shipping_phone, shipping_zip, shipping_city, shipping_email, created_at FROM orders WHERE id = $1 AND (tenant_id = $2 OR tenant_id = \'default\')', [id, req.tenantId || 'default']);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Pedido no encontrado' });
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
    res.json(result.rows[0]);
  } catch (err) {
    logger.error({ err: err.message }, 'Error obteniendo pedido público');
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

async function exportOrders(req, res) {
  const { format = 'csv' } = req.query;
  try {
    const { status, start_date, end_date, q } = req.query;
    let where = 'WHERE deleted_at IS NULL';
    const params = [];

    if (status) { params.push(status); where += ` AND status = $${params.length}`; }
    if (start_date) { params.push(start_date); where += ` AND date(created_at) >= $${params.length}`; }
    if (end_date) { params.push(end_date); where += ` AND date(created_at) <= $${params.length}`; }
    if (q) { params.push(`%${q}%`); where += ` AND (customer->>'name' ILIKE $${params.length} OR customer->>'email' ILIKE $${params.length})`; }

    const result = await query(`SELECT * FROM orders ${where} ORDER BY created_at DESC`, params);

    if (format === 'pdf') {
      const path = require('path');
      const fs = require('fs');
      const PDFDocument = require('pdfkit');
      const filepath = path.join(__dirname, '..', '..', 'uploads', 'receipts', `pedidos-export-${Date.now()}.pdf`);
      if (!fs.existsSync(path.dirname(filepath))) fs.mkdirSync(path.dirname(filepath), { recursive: true });
      const doc = new PDFDocument({ size: 'A4', margin: 50 });
      const stream = fs.createWriteStream(filepath);
      doc.pipe(stream);

      doc.fontSize(16).font('Helvetica-Bold').text('Reporte de Pedidos - Artesanías Gualeguay');
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
}

module.exports = { getOrders, getUserOrders, getOrderDetail, getOrderReceipt, getOrderActivities, getPublicOrderTrack, exportOrders };