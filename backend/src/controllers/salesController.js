const { query } = require('../lib/db');
const logger = require('../lib/logger');
const { syncBus } = require('../routes/sync');

const getSales = async (req, res) => {
  try {
    const { start_date, end_date, product_id, limit, offset } = req.query;
    let where = 'WHERE TRUE';
    const params = [];

    if (start_date) { params.push(start_date); where += ` AND date(sale_date) >= $${params.length}`; }
    if (end_date) { params.push(end_date); where += ` AND date(sale_date) <= $${params.length}`; }
    if (product_id) { params.push(Number(product_id)); where += ` AND product_id = $${params.length}`; }

    const limitNum = Number(limit) || 50;
    const offsetNum = Number(offset) || 0;

    params.push(limitNum, offsetNum);

    const [countResult, result] = await Promise.all([
      query(`SELECT COUNT(*) as total FROM sales ${where}`, params.slice(0, -2)),
      query(
        `SELECT s.*, p.name as product_name FROM sales s LEFT JOIN products p ON p.id = s.product_id ${where} ORDER BY s.created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
        params
      )
    ]);

    res.json({
      sales: result.rows,
      total: Number(countResult.rows[0]?.total || 0),
      limit: limitNum,
      offset: offsetNum
    });
  } catch (err) {
    logger.error({ err: err.message }, 'Error obteniendo ventas manuales');
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

const createManualSale = async (req, res) => {
  const { product_id, quantity } = req.body || {};

  if (!product_id) {
    return res.status(400).json({ error: 'product_id es requerido' });
  }

  const qty = Number(quantity);
  if (!qty || qty < 1 || !Number.isInteger(qty)) {
    return res.status(400).json({ error: 'quantity debe ser un entero positivo' });
  }

  try {
    const productResult = await query(
      'SELECT id, name, price, stock, active, deleted FROM products WHERE id = $1',
      [Number(product_id)]
    );

    if (productResult.rows.length === 0) {
      return res.status(404).json({ error: 'Producto no encontrado' });
    }

    const product = productResult.rows[0];
    if (product.deleted) {
      return res.status(400).json({ error: 'No se pueden registrar ventas de productos eliminados' });
    }

    const unitPrice = Number(product.price);
    if (unitPrice < 0) {
      return res.status(400).json({ error: 'El precio del producto es inválido' });
    }

    const total = unitPrice * qty;

    const insertResult = await query(
      `INSERT INTO sales (product_id, quantity, unit_price, total, sale_date, created_at)
       VALUES ($1, $2, $3, $4, CURRENT_DATE, CURRENT_TIMESTAMP) RETURNING *`,
      [Number(product_id), qty, unitPrice, total]
    );

    const created = insertResult.rows[0];

    try { syncBus.emit('sales_updated', { id: created.id }); } catch (e) { /* noop */ }

    res.status(201).json({
      ok: true,
      sale: {
        id: created.id,
        product_id: created.product_id,
        quantity: created.quantity,
        unit_price: created.unit_price,
        total: created.total,
        sale_date: created.sale_date,
        product_name: product.name,
        created_at: created.created_at
      }
    });
    logger.info({ saleId: created.id, productId: Number(product_id), qty, total }, 'Venta manual registrada');
  } catch (err) {
    logger.error({ err: err.message, stack: err.stack }, 'Error creando venta manual');
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

module.exports = {
  getSales,
  createManualSale
};
