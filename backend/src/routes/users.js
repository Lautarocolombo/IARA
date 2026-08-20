const express = require('express');
const router = express.Router();
const { getUsers, createUser, updateUser, deleteUser } = require('../controllers/usersController');
const { adminAuth, adminOnly } = require('../middleware/auth');

router.get('/users', adminAuth, adminOnly, getUsers);
router.post('/users', adminAuth, adminOnly, createUser);
router.put('/users/:id', adminAuth, adminOnly, updateUser);
router.delete('/users/:id', adminAuth, adminOnly, deleteUser);

module.exports = router;
