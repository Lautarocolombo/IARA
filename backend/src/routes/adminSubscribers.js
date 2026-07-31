const express = require('express');
const router = express.Router();
const { adminAuth } = require('../middleware/auth');
const { getAdminSubscribers, updateSubscriber, deleteSubscriber } = require('../controllers/subscribersController');

router.get('/', adminAuth, getAdminSubscribers);
router.put('/:id', adminAuth, updateSubscriber);
router.delete('/:id', adminAuth, deleteSubscriber);

module.exports = router;