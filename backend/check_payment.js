require('dotenv').config();
const { Pool } = require('pg');

async function main() {
  const pool = new Pool({ 
    connectionString: process.env.DATABASE_URL, 
    ssl: { rejectUnauthorized: false } 
  });

  try {
    const result = await pool.query('SELECT * FROM payment_config LIMIT 1');
    console.log('Payment config:', JSON.stringify(result.rows[0], null, 2));
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await pool.end();
  }
}

main();
