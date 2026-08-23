const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const { login, refresh, logout, changePassword, requestPasswordReset, resetPassword } = require('../controllers/authController');
const { exportUserData, deleteUserData } = require('../controllers/dataController');
const { adminAuth } = require('../middleware/auth');

function userOrAdminAuth(req, res, next) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : req.headers['x-admin-token'] || req.headers['x-user-token'] || req.cookies?.adminToken;

  if (!token) {
    return res.status(401).json({ error: 'No autorizado' });
  }

  try {
    const JWT_SECRET = process.env.JWT_SECRET;
    if (!JWT_SECRET) {
      return res.status(500).json({ error: 'JWT_SECRET no configurado en el servidor' });
    }
    const decoded = jwt.verify(token, JWT_SECRET);
    if (!decoded.username) {
      return res.status(401).json({ error: 'Token inválido' });
    }
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Token inválido o expirado' });
  }
}

router.post('/login', login);
router.post('/refresh', refresh);
router.post('/logout', logout);
router.put('/change-password', adminAuth, changePassword);
router.post('/forgot-password', requestPasswordReset);
router.post('/reset-password', resetPassword);
router.get('/user/data-export', userOrAdminAuth, exportUserData);
router.delete('/user/data-delete', userOrAdminAuth, deleteUserData);

module.exports = router;
