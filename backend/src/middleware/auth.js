const jwt = require('jsonwebtoken');
const tokenBlacklist = require('../lib/tokenBlacklist');

const ROLE_PERMISSIONS = {
  admin: ['products:read', 'products:write', 'products:delete', 'orders:read', 'orders:write', 'orders:delete', 'categories:read', 'categories:write', 'categories:delete', 'testimonials:read', 'testimonials:write', 'testimonials:delete', 'reviews:read', 'reviews:write', 'reviews:delete', 'contacts:read', 'contacts:write', 'newsletter:read', 'site:read', 'site:write', 'earnings:read', 'settings:read', 'settings:write', 'payments:read', 'payments:write', 'uploads:read', 'uploads:write', 'sync:read', 'sync:write'],
  editor: ['products:read', 'products:write', 'orders:read', 'categories:read', 'categories:write', 'testimonials:read', 'testimonials:write', 'reviews:read', 'reviews:write', 'contacts:read', 'newsletter:read', 'site:read', 'settings:read'],
  viewer: ['products:read', 'orders:read', 'categories:read', 'testimonials:read', 'reviews:read', 'contacts:read', 'settings:read']
};

async function adminAuth(req, res, next) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : req.headers['x-admin-token'];

  if (!token) {
    return res.status(401).json({ error: 'No autorizado' });
  }

  try {
    const blacklisted = await tokenBlacklist.has(token);
    if (blacklisted) {
      return res.status(401).json({ error: 'Token revocado. Iniciá sesión nuevamente.' });
    }
    const JWT_SECRET = process.env.JWT_SECRET;
    if (!JWT_SECRET) {
      return res.status(500).json({ error: 'JWT_SECRET no configurado en el servidor' });
    }
    const decoded = jwt.verify(token, JWT_SECRET);
    if (!['admin', 'editor', 'viewer'].includes(decoded.role)) {
      return res.status(401).json({ error: 'No autorizado' });
    }
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Token inválido o expirado' });
  }
}

function adminOnly(req, res, next) {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ error: 'Solo administradores' });
  }
  next();
}

function requirePermission(permission) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'No autorizado' });
    }
    if (req.user.role === 'admin') {
      return next();
    }
    const rolePerms = ROLE_PERMISSIONS[req.user.role] || [];
    if (rolePerms.includes(permission)) {
      return next();
    }
    const perms = req.user.permissions || {};
    if (perms.all === true || perms[permission] === true) {
      return next();
    }
    return res.status(403).json({ error: `Permiso requerido: ${permission}` });
  };
}

function getRolePermissions(role) {
  return ROLE_PERMISSIONS[role] || [];
}

module.exports = { adminAuth, adminOnly, requirePermission, getRolePermissions, ROLE_PERMISSIONS };
