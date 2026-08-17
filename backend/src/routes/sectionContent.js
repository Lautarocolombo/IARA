const express = require('express');
const router = express.Router();
const { adminAuth } = require('../middleware/auth');
const { getSectionContent, upsertSectionContent } = require('../controllers/sectionContentController');

router.get('/section-content/:sectionKey', getSectionContent);
router.put('/admin/section-content/:sectionKey', adminAuth, upsertSectionContent);

module.exports = router;
