const jwt = require('jsonwebtoken');
const { setTenant } = require('../lib/db');

async function tenantContext(req, res, next) {
  try {
    let tenantId = 'default';
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : req.headers['x-admin-token'];

    if (token && process.env.JWT_SECRET) {
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        if (decoded.role === 'admin') {
          tenantId = 'default';
        } else if (decoded.tenant_id) {
          tenantId = decoded.tenant_id;
        } else if (decoded.user) {
          const { query } = require('../lib/db');
          const result = await query('SELECT tenant_id FROM users WHERE username = $1', [decoded.user]);
          if (result.rows[0]?.tenant_id) {
            tenantId = result.rows[0].tenant_id;
          }
        }
      } catch (err) {
        // Token inválido, usar default
      }
    }

    await setTenant(tenantId);
    req.tenantId = tenantId;
    next();
  } catch (err) {
    next();
  }
}

module.exports = { tenantContext };
