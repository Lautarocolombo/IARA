const express = require('express');
const router = express.Router();
const { adminAuth, requirePermission } = require('../middleware/auth');
const {
  getInventoryMovements,
  getInventoryAlerts,
  resolveInventoryAlert
} = require('../controllers/inventoryController');

router.get('/movements', adminAuth, requirePermission('products:read'), getInventoryMovements);
router.get('/alerts', adminAuth, requirePermission('products:read'), getInventoryAlerts);
router.post('/alerts/:id/resolve', adminAuth, requirePermission('products:write'), resolveInventoryAlert);

module.exports = router;
