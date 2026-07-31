const express = require('express');
const router = express.Router();
const { adminAuth } = require('../middleware/auth');
const { getSettings, updateSettings } = require('../controllers/settingsController');

router.get('/', adminAuth, getSettings);
router.put('/', adminAuth, updateSettings);

module.exports = router;