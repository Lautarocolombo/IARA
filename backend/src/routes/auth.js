const express = require('express');
const router = express.Router();
const { login, debugAuth } = require('../controllers/authController');

router.post('/login', login);
router.post('/debug-auth', debugAuth);

module.exports = router;
