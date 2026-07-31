const fs = require('fs');
const path = require('path');
const { query } = require('./db');

// Cache the template in memory; re-read only if the file changes on disk.
let templateCache = null;
let templateMtime = 0;

function readTemplate(templatePath) {
  const stat = fs.statSync(templatePath);
  if (!templateCache || stat.mtimeMs !== templateMtime) {
    templateCache = fs.readFileSync(templatePath, 'utf8');
    templateMtime = stat.mtimeMs;
  }
  return templateCache;
}

function escapeAttr(str) {
  return String(str || '').replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

function truncate(str, max) {
  const s = String(str || '');
  return s.length > max ? s.slice(0, max - 1).trimEnd() + '…' : s;
}

/**
 * Middleware factory. staticDir = absolute path to /public,
 * baseUrl = absolute site URL used to build canonical/og:url and image URLs.
 */
function productMetaMiddleware(staticDir, baseUrl) {
  const templatePath = path.join(staticDir, 'pages', 'product.html');

  return async function handleProductPage(req, res, next) {
    try {
      const id = Number(req.query.id);
      if (!id || !Number.isInteger(id) || id <= 0) return next();

      const result = await query(
        'SELECT id, name, description, price, stock, image FROM products WHERE id = $1',
        [id]
      );
      if (result.rows.length === 0) return next();
      const product = result.rows[0];

      let imgResult;
      try {
        imgResult = await query(
          'SELECT url FROM product_images WHERE product_id = $1 ORDER BY is_primary DESC, sort_order ASC LIMIT 1',
          [id]
        );
      } catch (e) {
        imgResult = { rows: [] };
      }
      const rawImg = imgResult.rows[0]?.url || product.image || '';
      const imgUrl = rawImg && !rawImg.startsWith('http') ? `${baseUrl}${rawImg.startsWith('/') ? '' : '/'}${rawImg}` : rawImg;
      const fallbackImg = `${baseUrl}/assets/og-default.jpg`;

      const title = `${truncate(product.name, 60)} | IARA`;
      const description = truncate(product.description || 'Producto artesanal de IARA - Gualeguay', 160);
      const canonicalUrl = `${baseUrl}/pages/product.html?id=${id}`;
      const price = Number(product.price || 0).toFixed(2);
      const availability = Number(product.stock ?? 0) > 0 ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock';

      const jsonLd = JSON.stringify({
        '@context': 'https://schema.org/',
        '@type': 'Product',
        name: product.name,
        description: product.description || '',
        image: imgUrl || fallbackImg,
        offers: {
          '@type': 'Offer',
          url: canonicalUrl,
          price,
          priceCurrency: 'ARS',
          availability
        }
      });

      let html = readTemplate(templatePath);

      html = html.replace(
        /<title>.*?<\/title>/,
        `<title>${escapeAttr(title)}</title>`
      );
      html = html.replace(
        /<meta name="description" content=".*?" \/>/,
        `<meta name="description" content="${escapeAttr(description)}" />`
      );
      // Insert OG/Twitter tags + JSON-LD right before </head>
      const extraTags = `
  <link rel="canonical" href="${escapeAttr(canonicalUrl)}" />
  <meta property="og:type" content="product" />
  <meta property="og:title" content="${escapeAttr(title)}" />
  <meta property="og:description" content="${escapeAttr(description)}" />
  <meta property="og:image" content="${escapeAttr(imgUrl || fallbackImg)}" />
  <meta property="og:url" content="${escapeAttr(canonicalUrl)}" />
  <meta property="product:price:amount" content="${escapeAttr(price)}" />
  <meta property="product:price:currency" content="ARS" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${escapeAttr(title)}" />
  <meta name="twitter:description" content="${escapeAttr(description)}" />
  <meta name="twitter:image" content="${escapeAttr(imgUrl || fallbackImg)}" />
  <script type="application/ld+json">${jsonLd}</script>
</head>`;
      html = html.replace('</head>', extraTags);

      res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=300');
      res.send(html);
    } catch (err) {
      // Any failure: fall back to the plain static file, never break the page.
      next();
    }
  };
}

module.exports = { productMetaMiddleware };
