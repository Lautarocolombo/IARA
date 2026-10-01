const express = require('express');
const router = express.Router();
const { getPublicConfig } = require('../controllers/configController');

router.get('/config', getPublicConfig);

module.exports = router;