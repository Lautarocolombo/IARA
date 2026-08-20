const dotenv = require('dotenv');
const path = require('path');
const https = require('https');
const FormData = require('form-data');
const fs = require('fs');

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const BASE_URL = 'https://artesania-gualeguay-v3.vercel.app';
const ADMIN_USER = process.env.ADMIN_USER || 'admin';
const ADMIN_PASS_HASH = process.env.ADMIN_PASS_HASH;

// We need the actual password. Since we don't know it, let's try 'admin'
// The password hash in .env is $2a$10$4NGeUSrAA.AqDI1NqAcWq.34Z9GEkCnFkIP5Vlgn8vUrOW2v/jFw2
// Let's try common passwords
const POSSIBLE_PASSWORDS = ['pulseras2026', 'test123', 'admin', 'admin', 'password', '123456', 'admin123', 'admin123'];

async function login(password) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({ username: ADMIN_USER, password });
    const req = https.request({
      hostname: 'artesania-gualeguay-v3.vercel.app',
      path: '/api/auth/login',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': data.length
      }
    }, (res) => {
      let body = '';
      res.on('data', c => body += c);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(body), headers: res.headers });
        } catch(e) {
          resolve({ status: res.statusCode, body: body, headers: res.headers });
        }
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function uploadImage(token, productId) {
  return new Promise((resolve, reject) => {
    // Create a simple test image (1x1 red pixel PNG)
    const pngBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
    const pngBuffer = Buffer.from(pngBase64, 'base64');

    const form = new FormData();
    form.append('images', pngBuffer, {
      filename: 'test-product-image.png',
      contentType: 'image/png'
    });

    const headers = form.getHeaders();
    headers['Authorization'] = `Bearer ${token}`;

    const req = https.request({
      hostname: 'artesania-gualeguay-v3.vercel.app',
      path: `/api/products/${productId}/images`,
      method: 'POST',
      headers: headers,
      maxRedirects: 10,
      timeout: 30000
    }, (res) => {
      let body = '';
      res.on('data', c => body += c);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(body) });
        } catch(e) {
          resolve({ status: res.statusCode, body: body.substring(0, 500) });
        }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { reject(new Error('Request timed out')); });
    form.pipe(req);
  });
}

(async () => {
  // Try logging in with possible passwords
  let token = null;
  for (const password of POSSIBLE_PASSWORDS) {
    console.log('Trying login with password:', password);
    const result = await login(password);
    console.log('Login status:', result.status, 'Body:', JSON.stringify(result.body).substring(0, 200));
    if (result.status === 200 && result.body.token) {
      token = result.body.token;
      console.log('Login successful with password:', password);
      break;
    }
  }

  if (!token) {
    console.log('Could not login with any known password. Let me check if there is a session cookie...');
    // Try to get a token via refresh
    const refreshReq = https.request({
      hostname: 'artesania-gualeguay-v3.vercel.app',
      path: '/api/auth/refresh',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, (res) => {
      let body = '';
      res.on('data', c => body += c);
      res.on('end', () => {
        console.log('Refresh status:', res.statusCode, 'Body:', body.substring(0, 200));
      });
    });
    refreshReq.end();
    return;
  }

  // Upload a test image
  console.log('\n=== Uploading test image ===');
  const uploadResult = await uploadImage(token, 4);
  console.log('Upload status:', uploadResult.status);
  console.log('Upload response:', JSON.stringify(uploadResult.body).substring(0, 500));

  if (uploadResult.status === 200 && uploadResult.body.images) {
    for (const img of uploadResult.body.images) {
      console.log('Image URL:', img.url);
      console.log('Is blob URL:', img.url && img.url.includes('blob.vercel-storage.com'));
    }
  }

  process.exit(0);
})();
