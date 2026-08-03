const express = require('express');
const router = express.Router();
const { adminAuth } = require('../middleware/auth');
const { getCustomers, getCustomer, updateCustomer, deleteCustomer } = require('../controllers/customersController');

router.get('/admin/customers', adminAuth, getCustomers);
router.get('/admin/customers/:id', adminAuth, getCustomer);
router.put('/admin/customers/:id', adminAuth, updateCustomer);
router.delete('/admin/customers/:id', adminAuth, deleteCustomer);

module.exports = router;
