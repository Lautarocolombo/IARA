const express = require('express');
const router = express.Router();
const { getPublicSettings } = require('../controllers/settingsController');

router.get('/settings/public', getPublicSettings);
router.get('/public', getPublicSettings);

module.exports = router;