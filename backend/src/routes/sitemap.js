const express = require('express');
const router = express.Router();
const { query } = require('../lib/db');
const logger = require('../lib/logger');

router.get('/sitemap', async (req, res) => {
  try {
    const products = await query('SELECT id, category, name FROM products');
    const baseUrl = process.env.SITE_URL || 'https://artesaniagualeguay.com';
    const pages = [
      { loc: '/', changefreq: 'daily', priority: 1.0 },
      { loc: '/pages/cart.html', changefreq: 'weekly', priority: 0.8 },
      { loc: '/pages/checkout.html', changefreq: 'weekly', priority: 0.8 },
      { loc: '/pages/orders.html', changefreq: 'monthly', priority: 0.7 },
      { loc: '/pages/privacy.html', changefreq: 'monthly', priority: 0.3 },
      { loc: '/pages/terms.html', changefreq: 'monthly', priority: 0.3 },
      { loc: '/pages/shipping.html', changefreq: 'monthly', priority: 0.3 },
      { loc: '/pages/faq.html', changefreq: 'monthly', priority: 0.3 },
      { loc: '/pages/contact.html', changefreq: 'monthly', priority: 0.3 }
    ];
    products.rows.forEach(p => {
      pages.push({
        loc: `/pages/product.html?id=${p.id}`,
        changefreq: 'weekly',
        priority: 0.6
      });
    });
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${pages.map(p => `  <url>
    <loc>${baseUrl}${p.loc}</loc>
    <changefreq>${p.changefreq}</changefreq>
    <priority>${p.priority}</priority>
  </url>`).join('\n')}
</urlset>`;
    res.set('Content-Type', 'application/xml');
    res.send(xml);
  } catch (err) {
    logger.error('Error generando sitemap:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

module.exports = router;