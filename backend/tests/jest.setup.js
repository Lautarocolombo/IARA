const fs = require('fs');
const path = require('path');

const dbDir = process.env.VERCEL ? '/tmp/ag-data' : path.join(__dirname, '..', 'data');
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}
