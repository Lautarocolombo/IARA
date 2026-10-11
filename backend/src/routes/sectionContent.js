const express = require('express');
const router = express.Router();
const { adminAuth } = require('../middleware/auth');
const { getSectionContent, upsertSectionContent } = require('../controllers/sectionContentController');

// Cache-Control para GET públicos de contenido: 60s cache, 5min stale-while-revalidate
const publicCache = (req, res, next) => {
  res.setHeader('Cache-Control', 'public, max-age=60, stale-while-revalidate=300');
  next();
};

router.get('/section-content/:sectionKey', publicCache, getSectionContent);
router.put('/admin/section-content/:sectionKey', adminAuth, upsertSectionContent);

module.exports = router;
