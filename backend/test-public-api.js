const dotenv = require('dotenv');
const path = require('path');
const http = require('http');

// Load production .env to get DATABASE_URL
dotenv.config({ path: path.join(__dirname, '.env') });

// Enable blob upload if token is provided via environment
if (process.env.BLOB_READ_WRITE_TOKEN) {
  logger.info('Test server: BLOB_READ_WRITE_TOKEN configurado para pruebas');
}
process.env.BACKEND_URL = 'http://localhost:3002';
process.env.PORT = '3002';
process.env.NODE_ENV = 'test';
process.env.ADMIN_PASS_HASH = '$2a$10$4NGeUSrAA.AqDI1NqAcWq.34Z9GEkCnFkIP5Vlgn8vUrOW2v/jFw2';

// Require the app (doesn't start server because require.main !== module)
const { app } = require('./src/server.js');
const logger = require('./src/lib/logger');

// Start server manually
const server = app.listen(3002, '0.0.0.0', () => {
  logger.info('Test server listening on port 3002');

  setTimeout(async () => {
    function req(urlPath, options = {}) {
      return new Promise((resolve, reject) => {
        const req = http.request({ hostname: 'localhost', port: 3002, path: urlPath, ...options }, (res) => {
          let body = '';
          res.on('data', c => body += c);
          res.on('end', () => {
            try { resolve({ status: res.statusCode, body: JSON.parse(body) }); }
            catch(e) { resolve({ status: res.statusCode, body: body.substring(0, 300) }); }
          });
        });
        req.on('error', reject);
        req.end();
      });
    }

    try {
      // Test 1: Health check
      console.log('=== Test 1: Health ===');
      const health = await req('/api/health');
      console.log('Health:', health.status, JSON.stringify(health.body));

      // Test 2: Public products
      console.log('\n=== Test 2: Public Products ===');
      const products = await req('/api/products/public?limit=5');
      console.log('Public products status:', products.status);
      if (products.status === 500) {
        console.log('ERROR BODY:', products.body);
        console.log('This is the 500 error we need to debug!');
      } else {
        const arr = Array.isArray(products.body) ? products.body : [];
        console.log('Products count:', arr.length);
        if (arr.length > 0) {
          console.log('First product has images?', !!arr[0].images);
          console.log('First product image URL:', arr[0].image || arr[0].images?.[0]?.url || 'NONE');
        }
      }

      // Test 3: Single product
      console.log('\n=== Test 3: Single Product ===');
      const product = await req('/api/products/1');
      console.log('Product 1 status:', product.status);
      if (product.status === 200) {
        console.log('Product name:', product.body.name);
        console.log('Product image:', product.body.image);
        console.log('Product images array:', product.body.images?.length, 'images');
        if (product.body.images?.length > 0) {
          console.log('First image URL:', product.body.images[0].url);
        }
      }

      console.log('\n=== DONE ===');
    } catch (err) {
      console.error('Test error:', err.message);
    } finally {
      server.close();
      process.exit(0);
    }
  }, 12000);
});
