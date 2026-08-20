const http = require('http');

function makeRequest(method, path, body) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const req = http.request({
      hostname: 'localhost',
      port: 3000,
      path,
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {})
      }
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => resolve({ status: res.statusCode, body }));
    });
    req.on('error', (e) => reject(e));
    if (data) req.write(data);
    req.end();
  });
}

(async () => {
  try {
    const login = await makeRequest('POST', '/api/auth/login', { username: 'admin', password: 'pulseras2026' });
    console.log('login status:', login.status);
    console.log('login body:', login.body);
    if (login.status === 200) {
      const token = JSON.parse(login.body).token;
      const authHeader = { Authorization: 'Bearer ' + token };

      const getRes = await makeRequest('GET', '/api/admin/products/1', null, authHeader);
      console.log('get /1 status:', getRes.status);
      console.log('get /1 body:', getRes.body);
    }
  } catch (e) {
    console.error('error:', e.message);
  }
  process.exit(0);
})();
