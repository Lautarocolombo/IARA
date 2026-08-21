const { Pool } = require('pg');

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('ERROR: DATABASE_URL no está definida.');
  process.exit(1);
}

const pool = new Pool({ connectionString: DATABASE_URL });

async function main() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const checks = [
      { column: 'name', label: 'Nombre' },
      { column: 'comment', label: 'Comentario' },
      { column: 'role', label: 'Cargo' }
    ];

    let totalFixed = 0;

    for (const col of checks) {
      const findRes = await client.query(
        `SELECT id, ${col.column} FROM testimonials WHERE ${col.column} LIKE $1`,
        ['%Ã%']
      );

      if (findRes.rows.length === 0) {
        console.log(`[${col.label}] No hay registros corruptos detectados.`);
        continue;
      }

      console.log(`[${col.label}] ${findRes.rows.length} registro(s) con encoding corrupto:`);
      findRes.rows.forEach(r => {
        console.log(`  ID ${r.id}: "${r[col.column]}"`);
      });

      const updateRes = await client.query(
        `UPDATE testimonials SET ${col.column} = convert_from(convert_to(${col.column}, 'LATIN1'), 'UTF8') WHERE ${col.column} LIKE $1 RETURNING id, ${col.column}`,
        ['%Ã%']
      );

      console.log(`[${col.label}] ${updateRes.rows.length} registro(s) corregido(s).`);
      totalFixed += updateRes.rows.length;
    }

    await client.query('COMMIT');
    console.log(`\nTotal corregidos: ${totalFixed}`);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

main();
