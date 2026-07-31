const { query } = require('../lib/db');
const { productSchema } = require('../lib/validators');

const enrichProductsWithImages = async (products) => {
  if (!products || products.length === 0) return products;
  const ids = products.map(p => p.id).filter(Boolean);
  if (ids.length === 0) return products;
  try {
    const placeholders = ids.map((_, i) => `$${i + 1}`).join(',');
    const imgsResult = await query(`SELECT product_id, url, alt, sort_order, is_primary FROM product_images WHERE product_id IN (${placeholders}) ORDER BY product_id, sort_order ASC`, ids);
    const byProduct = imgsResult.rows.reduce((acc, img) => {
      const pid = img.product_id;
      if (!acc[pid]) acc[pid] = [];
      acc[pid].push({ url: img.url, alt: img.alt, sort_order: img.sort_order, is_primary: img.is_primary });
      return acc;
    }, {});
    return products.map(p => ({ ...p, images: byProduct[p.id] || [] }));
  } catch (err) {
    return products;
  }
};

const enrichProductsWithReviews = async (products) => {
  if (!products || products.length === 0) return products;
  const ids = products.map(p => p.id).filter(Boolean);
  if (ids.length === 0) return products;
  try {
    const placeholders = ids.map((_, i) => `$${i + 1}`).join(',');
    const reviewsResult = await query(`SELECT product_id, COUNT(*) AS reviews_count, AVG(rating) AS avg_rating FROM reviews WHERE product_id IN (${placeholders}) AND active = true GROUP BY product_id`, ids);
    const byProduct = reviewsResult.rows.reduce((acc, r) => {
      acc[r.product_id] = { reviews_count: Number(r.reviews_count || 0), avg_rating: Number(r.avg_rating || 0) };
      return acc;
    }, {});
    return products.map(p => ({ ...p, reviews_count: byProduct[p.id]?.reviews_count || 0, avg_rating: byProduct[p.id]?.avg_rating || 0 }));
  } catch (err) {
    return products;
  }
};

const getPublicProductById = async (req, res) => {
  try {
    const id = Number(req.params.id);
    const result = await query('SELECT * FROM products WHERE id = $1', [id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Producto no encontrado' });
    const product = result.rows[0];
    const enriched = await enrichProductsWithImages([product]);
    const enriched2 = await enrichProductsWithReviews(enriched);
    res.json(enriched2[0]);
  } catch (err) {
    console.error('Error obteniendo producto:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

const getPublicProducts = async (req, res) => {
  try {
    const result = await query('SELECT * FROM products ORDER BY id ASC');
    let products = await enrichProductsWithImages(result.rows);
    products = await enrichProductsWithReviews(products);
    res.json(products);
  } catch (err) {
    console.error('Error obteniendo productos:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

const getAdminProducts = async (req, res) => {
  try {
    const search = (req.query.search || '').trim();
    const category = (req.query.category || '').trim();
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 10));
    const offset = (page - 1) * limit;

    const conditions = [];
    const params = [];
    let idx = 1;

    if (search) {
      conditions.push(`(p.name LIKE $${idx} OR p.description LIKE $${idx + 1} OR p.category LIKE $${idx + 2})`);
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
      idx += 3;
    }
    if (category) {
      conditions.push(`p.category = $${idx}`);
      params.push(category);
      idx++;
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const dataSql = `SELECT p.* FROM products p ${where} ORDER BY p.id ASC LIMIT $${idx} OFFSET $${idx + 1}`;
    const countSql = `SELECT COUNT(*) AS total FROM products p ${where}`;

    const dataResult = await query(dataSql, [...params, limit, offset]);
    const countResult = await query(countSql, params);
    let products = await enrichProductsWithImages(dataResult.rows);
    products = await enrichProductsWithReviews(products);

    res.json({
      data: products,
      meta: {
        page,
        limit,
        total: Number(countResult.rows[0]?.total || 0),
        totalPages: Math.max(1, Math.ceil(Number(countResult.rows[0]?.total || 0) / limit))
      }
    });
  } catch (err) {
    console.error('Error obteniendo productos (admin):', err);
    res.status(500).json({ error: err.message });
  }
};

const createProduct = async (req, res) => {
  try {
    const data = productSchema.parse(req.body);
    const result = await query(
      'INSERT INTO products (name, category, price, description, emoji, image, badge, stock) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *',
      [data.name, data.category, Number(data.price), data.description || '', data.emoji || '📿', data.image || '', data.badge || '', Number(data.stock)]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    if (err.name === 'ZodError') {
      return res.status(400).json({ error: 'Datos inválidos' });
    }
    console.error('Error creando producto:', err);
    res.status(500).json({ error: err.message });
  }
};

const updateProduct = async (req, res) => {
  const id = Number(req.params.id);
  try {
    const data = productSchema.partial().parse(req.body);
    const fields = Object.keys(data);
    if (!fields.length) return res.status(400).json({ error: 'Sin datos para actualizar' });
    const setClause = fields.map((_, i) => `${fields[i]} = $${i + 1}`).join(', ');
    const values = fields.map(f => (['price', 'stock'].includes(f) ? Number(data[f]) : data[f]));
    values.push(id);
    const result = await query(`UPDATE products SET ${setClause}, updated_at = CURRENT_TIMESTAMP WHERE id = $${values.length} RETURNING *`, values);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Producto no encontrado' });
    res.json(result.rows[0]);
  } catch (err) {
    if (err.name === 'ZodError') {
      return res.status(400).json({ error: 'Datos inválidos' });
    }
    console.error('Error actualizando producto:', err);
    res.status(500).json({ error: err.message });
  }
};

const deleteProduct = async (req, res) => {
  const id = Number(req.params.id);
  try {
    const result = await query('DELETE FROM products WHERE id = $1 RETURNING id', [id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Producto no encontrado' });
    res.json({ ok: true });
  } catch (err) {
    console.error('Error eliminando producto:', err);
    res.status(500).json({ error: err.message });
  }
};

module.exports = { getPublicProducts, getPublicProductById, getAdminProducts, createProduct, updateProduct, deleteProduct };
