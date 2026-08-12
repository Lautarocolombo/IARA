const { query } = require('../lib/db');
const logger = require('../lib/logger');
const { safeJsonParse } = require('../lib/parser');
const { syncBus } = require('../routes/sync');
const path = require('path');
const fs = require('fs');

const isVercel = process.env.VERCEL === 'true';
const isRender = !!process.env.RENDER_EXTERNAL_HOSTNAME;
const comprobantesDir = (isVercel || isRender) ? '/tmp/uploads/comprobantes' : path.join(__dirname, '..', '..', 'uploads', 'comprobantes');

function ensureComprobantesDir() {
  if (!fs.existsSync(comprobantesDir)) {
    fs.mkdirSync(comprobantesDir, { recursive: true });
  }
}

async function getAdminPaymentProofs(req, res) {
  try {
    const { status, search, page, limit } = req.query;
    let where = 'WHERE TRUE';
    const params = [];

    if (status) { params.push(status); where += ` AND status = $${params.length}`; }
    if (search) {
      params.push('%' + search + '%');
      where += ` AND (customer_name ILIKE $${params.length} OR CAST(order_id AS TEXT) LIKE $${params.length})`;
    }

    const countResult = await query(`SELECT COUNT(*) as total FROM payment_proofs ${where}`, params);
    const total = Number(countResult.rows[0]?.total || 0);

    const pageNum = Number(page) || 1;
    const limitNum = Number(limit) || 15;
    const offset = (pageNum - 1) * limitNum;

    params.push(limitNum, offset);
    const result = await query(
      `SELECT * FROM payment_proofs ${where} ORDER BY created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );

    res.json({
      proofs: result.rows,
      total,
      page: pageNum,
      pages: Math.ceil(total / limitNum),
      hasMore: pageNum * limitNum < total
    });
  } catch (err) {
    logger.error({ err: err.message }, 'Error obteniendo comprobantes');
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

async function uploadPaymentProof(req, res) {
  ensureComprobantesDir();
  try {
    const orderId = Number(req.params.orderId || req.params.id);
    const orderIdNum = orderId;

    if (!orderIdNum || orderIdNum <= 0) {
      return res.status(400).json({ error: 'ID de pedido inválido' });
    }

    const orderResult = await query('SELECT * FROM orders WHERE id = $1', [orderIdNum]);
    if (orderResult.rows.length === 0) {
      return res.status(404).json({ error: 'Pedido no encontrado' });
    }
    const order = orderResult.rows[0];

    if (!req.file) {
      return res.status(400).json({ error: 'No se recibió el comprobante' });
    }

    const filename = path.basename(req.file.path);
    const proofUrl = `/uploads/comprobantes/${filename}`;
    const amount = Number(order.total || 0);
    const customerData = safeJsonParse(order.customer, {});
    const customerNameStr = ((req.body && req.body.customerName) || '').toString().trim() || (customerData.name || '');

    const insertResult = await query(
      'INSERT INTO payment_proofs (order_id, customer_name, amount, proof_url) VALUES ($1, $2, $3, $4) RETURNING *',
      [orderIdNum, customerNameStr, amount, proofUrl]
    );

    const proof = insertResult.rows[0];
    await query(
      'INSERT INTO activity_log (username, action, entity_type, entity_id, details, related_order_id, tenant_id) VALUES ($1, $2, $3, $4, $5, $6, $7)',
      ['Cliente', 'Comprobante subido', 'payment_proof', proof.id, `Pedido #${orderIdNum}`, orderIdNum, req.headers['x-tenant-id'] || req.user?.tenant_id || 'default']
    );

    try { syncBus.emit('payment_proof_uploaded', { orderId: orderIdNum, proofId: proof.id }); } catch (e) { /* noop */ }

    res.status(201).json({ ok: true, proof });
  } catch (err) {
    logger.error({ err: err.message }, 'Error subiendo comprobante');
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

async function approvePaymentProof(req, res) {
  try {
    const proofId = Number(req.params.id);
    const result = await query('SELECT * FROM payment_proofs WHERE id = $1', [proofId]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Comprobante no encontrado' });

    const proof = result.rows[0];
    if (proof.status !== 'pending') {
      return res.status(400).json({ error: 'Este comprobante ya fue procesado' });
    }

    const orderId = proof.order_id;
    await query('UPDATE payment_proofs SET status = $1, reviewed_at = CURRENT_TIMESTAMP WHERE id = $2', ['approved', proofId]);
    await query('UPDATE orders SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2', ['confirmed', orderId]);

    const user = req.user?.user || 'admin';
    await query(
      'INSERT INTO activity_log (username, action, entity_type, entity_id, details, related_order_id, tenant_id) VALUES ($1, $2, $3, $4, $5, $6, $7)',
      [user, 'Comprobante aprobado', 'payment_proof', proofId, `Pedido #${orderId}`, orderId, req.headers['x-tenant-id'] || req.user?.tenant_id || 'default']
    );

    try { syncBus.emit('payment_proof_approved', { orderId, proofId }); } catch (e) { /* noop */ }
    try { syncBus.emit('order_status_updated', { id: orderId, status: 'confirmed' }); } catch (e) { /* noop */ }

    res.json({ ok: true });
  } catch (err) {
    logger.error({ err: err.message }, 'Error aprobando comprobante');
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

async function rejectPaymentProof(req, res) {
  try {
    const proofId = Number(req.params.id);
    const { reason } = req.body || {};
    const result = await query('SELECT * FROM payment_proofs WHERE id = $1', [proofId]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Comprobante no encontrado' });

    const proof = result.rows[0];
    if (proof.status !== 'pending') {
      return res.status(400).json({ error: 'Este comprobante ya fue procesado' });
    }

    const orderId = proof.order_id;
    await query('UPDATE payment_proofs SET status = $1, rejection_reason = $2, reviewed_at = CURRENT_TIMESTAMP WHERE id = $3', ['rejected', reason || '', proofId]);

    const user = req.user?.user || 'admin';
    await query(
      'INSERT INTO activity_log (username, action, entity_type, entity_id, details, related_order_id, tenant_id) VALUES ($1, $2, $3, $4, $5, $6, $7)',
      [user, 'Comprobante rechazado', 'payment_proof', proofId, `Pedido #${orderId}. Motivo: ${reason || 'Sin motivo'}`, orderId, req.headers['x-tenant-id'] || req.user?.tenant_id || 'default']
    );

    try { syncBus.emit('payment_proof_rejected', { orderId, proofId, reason }); } catch (e) { /* noop */ }

    res.json({ ok: true });
  } catch (err) {
    logger.error({ err: err.message }, 'Error rechazando comprobante');
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

async function getPaymentStats(req, res) {
  try {
    const now = new Date();
    const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString();

    const [currentMonthApproved, prevMonthApproved, currentMonthRejected, currentMonthPending, activeConfig] = await Promise.all([
      query('SELECT COUNT(*) as count, COALESCE(SUM(amount),0) as total FROM payment_proofs WHERE status = $1 AND created_at >= $2', ['approved', currentMonthStart]),
      query('SELECT COUNT(*) as count, COALESCE(SUM(amount),0) as total FROM payment_proofs WHERE status = $1 AND created_at >= $2 AND created_at < $3', ['approved', prevMonthStart, currentMonthStart]),
      query('SELECT COUNT(*) as count FROM payment_proofs WHERE status = $1 AND created_at >= $2', ['rejected', currentMonthStart]),
      query('SELECT COUNT(*) as count FROM payment_proofs WHERE status = $1', ['pending']),
      query('SELECT active, transfer_alias, holder_name FROM payment_config LIMIT 1')
    ]);

    const approvedCount = Number(currentMonthApproved.rows[0]?.count || 0);
    const approvedTotal = Number(currentMonthApproved.rows[0]?.total || 0);
    const prevCount = Number(prevMonthApproved.rows[0]?.count || 0);
    const prevTotal = Number(prevMonthApproved.rows[0]?.total || 0);
    const rejectedCount = Number(currentMonthRejected.rows[0]?.count || 0);
    const pendingCount = Number(currentMonthPending.rows[0]?.count || 0);

    const countVariation = prevCount > 0 ? ((approvedCount - prevCount) / prevCount) * 100 : 0;
    const totalVariation = prevTotal > 0 ? ((approvedTotal - prevTotal) / prevTotal) * 100 : 0;

    const last15Days = [];
    for (let i = 14; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      last15Days.push({ date: dateStr, label: d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' }) });
    }

    const dailyResult = await query(
      'SELECT DATE(created_at) as day, COUNT(*) as count, COALESCE(SUM(amount),0) as total FROM payment_proofs WHERE status = $1 AND created_at >= $2 GROUP BY DATE(created_at) ORDER BY DATE(created_at)',
      ['approved', last15Days[0].date]
    );
    const dailyMap = {};
    dailyResult.rows.forEach(function(r) { dailyMap[r.day] = r; });

    const chartData = last15Days.map(function(d) {
      const found = dailyMap[d.date];
      return { date: d.label, count: Number(found?.count || 0), total: Number(found?.total || 0) };
    });

    res.json({
      approvedCount,
      approvedTotal,
      rejectedCount,
      pendingCount,
      countVariation,
      totalVariation,
      isAliasActive: activeConfig.rows[0]?.active !== false,
      chartData
    });
  } catch (err) {
    logger.error({ err: err.message }, 'Error obteniendo estadísticas de pagos');
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

async function getAdminActivityLog(req, res) {
  try {
    const { page, limit } = req.query;
    const pageNum = Number(page) || 1;
    const limitNum = Number(limit) || 50;
    const offset = (pageNum - 1) * limitNum;

    const countResult = await query('SELECT COUNT(*) as total FROM activity_log WHERE entity_type = $1 OR details LIKE $2', ['payment_proof', '%Pedido%']);
    const total = Number(countResult.rows[0]?.total || 0);

    const result = await query(
      'SELECT * FROM activity_log WHERE entity_type = $1 OR details LIKE $2 ORDER BY created_at DESC LIMIT $3 OFFSET $4',
      ['payment_proof', '%Pedido%', limitNum, offset]
    );

    res.json({
      logs: result.rows,
      total,
      page: pageNum,
      pages: Math.ceil(total / limitNum)
    });
  } catch (err) {
    logger.error({ err: err.message }, 'Error obteniendo activity log');
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

module.exports = {
  getAdminPaymentProofs,
  uploadPaymentProof,
  approvePaymentProof,
  rejectPaymentProof,
  getPaymentStats,
  getAdminActivityLog
};
