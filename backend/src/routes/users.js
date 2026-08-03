const express = require('express');
const router = express.Router();
const { adminAuth, adminOnly } = require('../middleware/auth');
const { getUsers, getUser, createUser, updateUser, deleteUser } = require('../controllers/usersController');

router.get('/admin/users', adminAuth, adminOnly, getUsers);
router.get('/admin/users/:id', adminAuth, adminOnly, getUser);
router.post('/admin/users', adminAuth, adminOnly, createUser);
router.put('/admin/users/:id', adminAuth, adminOnly, updateUser);
router.delete('/admin/users/:id', adminAuth, adminOnly, deleteUser);

module.exports = router;
