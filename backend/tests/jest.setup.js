const fs = require('fs');
const path = require('path');

const dbDir = process.env.VERCEL ? '/tmp/ag-data' : path.join(__dirname, '..', 'data');
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

process.on('beforeExit', () => {
  try {
    const { pool } = require('../src/lib/db');
    if (pool && typeof pool.end === 'function') {
      pool.end().catch(() => {});
    }
  } catch (e) {
    // noop
  }
});

process.on('exit', () => {
  try {
    const { pool } = require('../src/lib/db');
    if (pool && typeof pool.end === 'function') {
      pool.end().catch(() => {});
    }
  } catch (e) {
    // noop
  }
});
