const fs = require('fs');
const path = require('path');

const dbDir = process.env.VERCEL ? '/tmp/ag-data' : path.join(__dirname, '..', 'data');
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

async function cleanup() {
  try {
    const { closeDB } = require('../src/lib/db');
    if (typeof closeDB === 'function') {
      await closeDB();
    }
  } catch (e) {
    // noop
  }
}

process.on('beforeExit', () => {
  cleanup().catch(() => {});
});

process.on('exit', () => {
  cleanup().catch(() => {});
});
