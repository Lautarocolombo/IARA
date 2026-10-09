const { Client } = require('pg');
require('dotenv').config();

const client = new Client({ connectionString: process.env.DATABASE_URL });
client.connect().then(async () => {
  const res = await client.query("SELECT column_name, is_nullable FROM information_schema.columns WHERE table_name = 'pgmigrations'");
  console.log('pgmigrations columns:', res.rows);
  
  const existing = await client.query("SELECT name FROM pgmigrations ORDER BY name");
  console.log('Existing migrations:', existing.rows.map(r => r.name));
  
  await client.end();
}).catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});