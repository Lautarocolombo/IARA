const express = require('express');
const router = express.Router();
const { login, refresh, logout, changePassword } = require('../controllers/authController');

router.post('/login', login);
router.post('/refresh', refresh);
router.post('/logout', logout);
router.put('/admin/change-password', require('../middleware/auth').adminAuth, changePassword);

module.exports = router;
