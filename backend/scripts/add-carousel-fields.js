const { Pool } = require('pg');

const NEON_URL = process.env.DATABASE_URL;
if (!NEON_URL) {
  console.error('ERROR: DATABASE_URL no está definida.');
  process.exit(1);
}

async function addCarouselFields() {
  const pool = new Pool({
    connectionString: NEON_URL,
    ssl: { rejectUnauthorized: false },
    max: 5,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
    allowExitOnIdle: false
  });

  let client;
  try {
    client = await pool.connect();
    console.log('Conectado a Neon\n');
  } catch (err) {
    console.error('Error conectando:', err.message);
    await pool.end();
    process.exit(1);
  }

  try {
    // Verificar si las columnas ya existen
    const columns = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'carousel_images' 
      AND column_name IN ('caption', 'about_group')
    `);
    
    const existingColumns = columns.rows.map(r => r.column_name);
    console.log('Columnas existentes:', existingColumns);

    if (!existingColumns.includes('caption')) {
      await client.query('ALTER TABLE carousel_images ADD COLUMN caption TEXT DEFAULT \'\'');
      console.log('✅ Columna caption agregada');
    } else {
      console.log('⏭️ Columna caption ya existe');
    }

    if (!existingColumns.includes('about_group')) {
      await client.query('ALTER TABLE carousel_images ADD COLUMN about_group INTEGER DEFAULT 0');
      console.log('✅ Columna about_group agregada');
    } else {
      console.log('⏭️ Columna about_group ya existe');
    }

    // Actualizar datos de ejemplo
    await client.query(`
      UPDATE carousel_images 
      SET caption = CASE slot
        WHEN 1 THEN 'En cada pieza dejamos un pedacito de Gualeguay: horas de trabajo manual, materiales elegidos con cuidado y el orgullo de hacer las cosas bien.'
        WHEN 2 THEN 'En cada pieza dejamos un pedacito de Gualeguay: horas de trabajo manual, materiales elegidos con cuidado y el orgullo de hacer las cosas bien.'
        WHEN 3 THEN 'Artesanía Gualeguay nació en el corazón de Entre Ríos con la misión de crear pulseras, souvenirs y accesorios únicos que capturen la esencia de nuestra tierra.'
        WHEN 4 THEN 'Artesanía Gualeguay nació en el corazón de Entre Ríos con la misión de crear pulseras, souvenirs y accesorios únicos que capturen la esencia de nuestra tierra.'
        WHEN 5 THEN ''
      END,
      about_group = CASE slot
        WHEN 1 THEN 1
        WHEN 2 THEN 1
        WHEN 3 THEN 2
        WHEN 4 THEN 2
        WHEN 5 THEN 3
      END
      WHERE tenant_id = 'default'
    `);
    console.log('✅ Datos de ejemplo actualizados');

    // Verificar resultado
    const result = await client.query('SELECT slot, url, caption, about_group FROM carousel_images ORDER BY slot');
    console.log('\n=== CARRUSEL ACTUALIZADO ===');
    result.rows.forEach(r => {
      console.log(`Slot ${r.slot}: group=${r.about_group} | caption="${r.caption ? r.caption.substring(0, 50) + '...' : '(vacío)'}"`);
    });

  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  } finally {
    if (client) client.release();
    await pool.end();
  }
}

addCarouselFields().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
