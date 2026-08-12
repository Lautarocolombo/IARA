const { query } = require('../lib/db');
const logger = require('../lib/logger');

async function exportUserData(req, res) {
  try {
    const user = req.user?.user || req.user?.username;
    if (!user) return res.status(401).json({ error: 'No autorizado' });

    const userRow = await query('SELECT email, role FROM users WHERE username = $1 UNION SELECT email, role FROM customers WHERE email = $1 LIMIT 1', [user]);
    if (!userRow.rows.length) return res.status(404).json({ error: 'Usuario no encontrado' });
    const email = userRow.rows[0].email;

    const orders = await query('SELECT * FROM orders WHERE shipping_email = $1 OR customer->>\'email\' = $1', [email]);
    const contacts = await query('SELECT * FROM contacts WHERE email = $1', [email]);

    const data = {
      user,
      exportedAt: new Date().toISOString(),
      orders: orders.rows,
      contacts: contacts.rows
    };

    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="datos-${user}-${Date.now()}.json"`);
    res.json(data);
  } catch (err) {
    logger.error({ err: err.message }, 'Error exportando datos');
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

async function deleteUserData(req, res) {
  try {
    const user = req.user?.user || req.user?.username;
    if (!user) return res.status(401).json({ error: 'No autorizado' });

    const userRow = await query('SELECT email, role FROM users WHERE username = $1 UNION SELECT email, role FROM customers WHERE email = $1 LIMIT 1', [user]);
    if (!userRow.rows.length) return res.status(404).json({ error: 'Usuario no encontrado' });
    const email = userRow.rows[0].email;

    await query('UPDATE orders SET customer = jsonb_set(customer, \'{name}\', \'\'::jsonb), shipping_email = \'\', shipping_name = \'\', shipping_address = \'\', shipping_phone = \'\' WHERE shipping_email = $1 OR customer->>\'email\' = $1', [email]);
    await query('UPDATE contacts SET name = \'Anonimizado\', message = \'Eliminado por solicitud del usuario\' WHERE email = $1', [email]);
    await query('DELETE FROM users WHERE username = $1', [user]);
    await query('DELETE FROM customers WHERE email = $1', [email]);

    res.clearCookie('refreshToken', { path: '/' });
    res.json({ ok: true, message: 'Datos eliminados correctamente' });
  } catch (err) {
    logger.error({ err: err.message }, 'Error eliminando datos');
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

module.exports = { exportUserData, deleteUserData };
