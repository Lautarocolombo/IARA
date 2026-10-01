const express = require('express');
const router = express.Router();
const { getUsers, getUser, createUser, updateUser, deleteUser, loginUser } = require('../controllers/usersController');
const { adminAuth, adminOnly } = require('../middleware/auth');

router.post('/login', loginUser);
router.get('/', adminAuth, adminOnly, getUsers);
router.get('/:id', adminAuth, adminOnly, getUser);
router.post('/', adminAuth, adminOnly, createUser);
router.put('/:id', adminAuth, adminOnly, updateUser);
router.delete('/:id', adminAuth, adminOnly, deleteUser);

module.exports = router;
