require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
pool.query('SELECT id, username, password_hash, role, active, permissions FROM users WHERE username = $1', ['admin'])
  .then(r => {
    console.log('Neon admin:', JSON.stringify(r.rows[0], null, 2));
    return pool.end();
  })
  .catch(err => {
    console.error('Error:', err.message);
    process.exit(1);
  });
