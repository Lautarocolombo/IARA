const http = require('http');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: '.env' });

const BASE = 'https://api.artesaniagualeguay.com';
const ADMIN_USER = process.env.ADMIN_USER || 'admin';
// NOTE: put the real plain password here temporarily for this verification only
const ADMIN_PASS = process.env.ADMIN_PASS || '';

function request(method, urlPath, body) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlPath, BASE);
    const data = body ? JSON.stringify(body) : null;
    const req = http.request({
      hostname: url.hostname,
      path: url.pathname + url.search,
      method,
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: 15000
    }, (res) => {
      let raw = '';
      res.on('data', (chunk) => raw += chunk);
      res.on('end', () => {
        let parsed = null;
        try { parsed = JSON.parse(raw); } catch (e) { parsed = raw; }
        resolve({ status: res.statusCode, data: parsed, headers: res.headers });
      });
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

async function multipartUpload(filePath, fieldName, token) {
  const boundary = '----FormBoundary' + Date.now();
  const fileBuffer = fs.readFileSync(filePath);
  const fileName = path.basename(filePath);
  const contentType = 'image/png';

  const prefix = '--' + boundary + '\r\n';
  const mid = 'Content-Disposition: form-data; name="' + fieldName + '"; filename="' + fileName + '"\r\nContent-Type: ' + contentType + '\r\n\r\n';
  const suffix = '\r\n--' + boundary + '--\r\n';

  const bodyBuffer = Buffer.concat([
    Buffer.from(prefix + mid, 'utf8'),
    fileBuffer,
    Buffer.from(suffix, 'utf8')
  ]);

  return new Promise((resolve, reject) => {
    const url = new URL('/api/admin/upload', BASE);
    const req = http.request({
      hostname: url.hostname,
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'multipart/form-data; boundary=' + boundary,
        'Content-Length': bodyBuffer.length,
        'Authorization': 'Bearer ' + token
      },
      timeout: 15000
    }, (res) => {
      let raw = '';
      res.on('data', (chunk) => raw += chunk);
      res.on('end', () => {
        let parsed = null;
        try { parsed = JSON.parse(raw); } catch (e) { parsed = raw; }
        resolve({ status: res.statusCode, data: parsed });
      });
    });
    req.on('error', reject);
    req.write(bodyBuffer);
    req.end();
  });
}

(async () => {
  try {
    if (!ADMIN_PASS) {
      console.error('Falta ADMIN_PASS en backend/.env para esta verificación');
      process.exit(1);
    }

    console.log('1) Login...');
    const loginRes = await request('POST', '/api/auth/login', {
      username: ADMIN_USER,
      password: ADMIN_PASS
    });
    console.log('Login status:', loginRes.status);
    if (loginRes.status !== 200 || !loginRes.data.token) {
      console.error('Login failed:', loginRes.data);
      process.exit(1);
    }
    const token = loginRes.data.token;
    console.log('Token obtained:', token.slice(0, 12) + '...');

    console.log('2) Subiendo imagen de prueba a /api/admin/upload...');
    const testImagePath = path.join(__dirname, 'tests', 'fixtures', 'product-test.png');
    if (!fs.existsSync(testImagePath)) {
      console.error('No existe imagen de prueba en:', testImagePath);
      process.exit(1);
    }
    const uploadRes = await multipartUpload(testImagePath, 'image', token);
    console.log('Upload status:', uploadRes.status);
    console.log('Upload response:', JSON.stringify(uploadRes.data, null, 2));

    if (uploadRes.status === 200 && uploadRes.data.url) {
      const url = uploadRes.data.url;
      if (url.includes('blob.vercel-storage.com')) {
        console.log('\nSUCCESS: La imagen se subió a Vercel Blob correctamente.');
        console.log('URL:', url);
      } else if (url.startsWith('data:image')) {
        console.log('\nWARNING: La respuesta tiene data URI (fallback base64).');
        console.log('URL:', url.slice(0, 120) + '...');
      } else {
        console.log('\nWARNING: La URL no parece ser de Vercel Blob.');
        console.log('URL:', url);
      }
    } else {
      console.error('\nUpload failed');
      process.exit(1);
    }
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
})();
