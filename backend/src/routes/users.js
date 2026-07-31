const express = require('express');
const router = express.Router();
const { adminAuth } = require('../middleware/auth');
const { getUsers, updateUserRole } = require('../controllers/usersController');

router.get('/', adminAuth, getUsers);
router.put('/:id', adminAuth, updateUserRole);

module.exports = router;