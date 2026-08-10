require('dotenv').config();
const bcrypt = require('bcryptjs');
const { Pool } = require('pg');

async function main() {
  const newHash = bcrypt.hashSync('pulseras2026', 10);
  console.log('New hash:', newHash);

  const pool = new Pool({ 
    connectionString: process.env.DATABASE_URL, 
    ssl: { rejectUnauthorized: false } 
  });

  try {
    const result = await pool.query(
      'UPDATE users SET password_hash = $1, permissions = $2, updated_at = CURRENT_TIMESTAMP WHERE username = $3 RETURNING id, username, role, active, permissions',
      [newHash, JSON.stringify({ all: true }), 'Iara']
    );
    console.log('Updated user:', JSON.stringify(result.rows[0], null, 2));
  } catch (err) {
    console.error('Error updating user:', err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
