const http = require('http');
const path = require('path');
const dotenv = require('dotenv');
dotenv.config({ path: path.join(__dirname, '.env'), override: false });
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';
process.env.ALLOWED_ORIGINS = 'http://localhost:5173';
process.env.CSRF_SECRET = process.env.CSRF_SECRET || 'x';

const { app } = require(path.join(__dirname, 'src', 'server.js'));

const server = app.listen(0, async () => {
  const port = server.address().port;
  function req(method, p, headers = {}, body, readTimeoutMs = 2500) {
    return new Promise((resolve) => {
      const r = http.request({ host: '127.0.0.1', port, method, path: p, headers }, (res) => {
        let b = '';
        let done = false;
        const finish = () => {
          if (done) return; done = true;
          clearTimeout(timer);
          resolve({ status: res.statusCode, ct: res.headers['content-type'], body: b.slice(0, 120) });
        };
        const timer = setTimeout(() => { res.destroy(); finish(); }, readTimeoutMs);
        res.on('data', (c) => { b += c; if (b.includes(':') || b.length > 40) finish(); });
        res.on('end', finish);
        res.on('error', finish);
      });
      r.on('error', (e) => resolve({ error: e.message }));
      if (body) r.write(body);
      r.end();
    });
  }
  const mkBody = (items, customer) => JSON.stringify({
    items, total: 100, customer: customer || { name: 'Test', email: 'test@example.com' }
  });
  const cases = [
    ['GET', '/api/sync', {}, null, 2000],
    ['GET', '/api/v1/sync', {}, null, 2000],
    ['POST', '/api/orders', { 'Content-Type': 'application/json', Origin: 'http://localhost:5173' }, mkBody([{ id: 1, name: 'x', price: 100 }]), 2500],
    ['GET', '/api/health', {}, null, 2500],
  ];
  for (const [m, p, h, b, t] of cases) {
    const r = await req(m, p, h, b, t);
    console.log(`${m.padEnd(4)} ${p.padEnd(22)} -> ${String(r.status).padStart(3)} ${(r.ct || '').slice(0, 30).padEnd(32)} ${r.body || ''}`);
  }
  server.close();
  setTimeout(() => process.exit(0), 200);
});