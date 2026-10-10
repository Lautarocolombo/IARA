const fs = require('fs');
const path = require('path');
const logger = require('./logger');

const MIGRATIONS_DIR = path.join(__dirname, '..', '..', 'migrations');

async function ensureMigrationsTable(query) {
  await query('CREATE TABLE IF NOT EXISTS migrations (name TEXT PRIMARY KEY, applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)');
}

async function migrateFromPgMigrations(query, isLocalDb) {
  try {
    let pgMigrationsExists = false;
    if (isLocalDb) {
      const result = await query("SELECT COUNT(*) AS count FROM sqlite_master WHERE type='table' AND name='pgmigrations'");
      pgMigrationsExists = result.rows[0].count > 0;
    } else {
      const result = await query("SELECT COUNT(*) AS count FROM information_schema.tables WHERE table_name = 'pgmigrations'");
      pgMigrationsExists = result.rows[0].count > 0;
    }

    if (pgMigrationsExists) {
      logger.info('Migrando registros de pgmigrations a migrations...');
      const result = await query('SELECT name FROM pgmigrations');
      for (const row of result.rows) {
        await query('INSERT INTO migrations (name) VALUES ($1) ON CONFLICT (name) DO NOTHING', [row.name]);
      }
      logger.info({ count: result.rows.length }, 'Registros migrados de pgmigrations');
    }
  } catch (err) {
    logger.warn({ err: err.message }, 'No se pudo migrar desde pgmigrations (puede no existir)');
  }
}

async function getAppliedMigrations(query) {
  const result = await query('SELECT name FROM migrations');
  return new Set(result.rows.map(r => r.name));
}

/**
 * Repara conflictos de migraciones heredados:
 * - Elimina registros huérfanos de versiones antiguas del sistema (ej: "001_add_order_token")
 *   que compiten con el nombre "001_init_schema" y evitan que el migrador encuentre el archivo correcto.
 * - Marca como aplicadas las migraciones cuyos cambios ya están reflejados en el esquema
 *   (útil cuando las tablas se crearon manualmente o por un script legacy).
 */
async function repairMigrationConflicts(query, isLocalDb) {
  try {
    // 1. Eliminar registros huérfanos de migraciones antiguas que pueden causar conflictos
    const orphanMigrations = ['001_add_order_token'];
    for (const name of orphanMigrations) {
      const existing = await query('SELECT COUNT(*) AS count FROM migrations WHERE name = $1', [name]);
      if (existing.rows[0].count > 0) {
        await query('DELETE FROM migrations WHERE name = $1', [name]);
        logger.info({ migration: name }, 'Migración huérfana eliminada para evitar conflictos');
      }
    }

    // 2. Marcar 001_init_schema como aplicada si la tabla orders ya existe pero no está registrada
    let ordersExists = false;
    if (isLocalDb) {
      const result = await query("SELECT COUNT(*) AS count FROM sqlite_master WHERE type='table' AND name='orders'");
      ordersExists = result.rows[0].count > 0;
    } else {
      const result = await query("SELECT COUNT(*) AS count FROM information_schema.tables WHERE table_name = 'orders'");
      ordersExists = result.rows[0].count > 0;
    }
    if (ordersExists) {
      const initSchemaApplied = await query(
        'SELECT COUNT(*) AS count FROM migrations WHERE name = $1',
        ['001_init_schema.sql']
      );
      if (initSchemaApplied.rows[0].count === 0) {
        await query(
          'INSERT INTO migrations (name) VALUES ($1) ON CONFLICT (name) DO NOTHING',
          ['001_init_schema.sql']
        );
        logger.info('Migración 001_init_schema marcada como aplicada (tabla orders ya existía)');
      }
    }

    // 3. Marcar como aplicadas las migraciones legacy cuyos cambios ya están en el esquema
    //    (evita que el migrador intente ejecutarlas nuevamente y falle por columnas duplicadas)
    const legacyMigrations = [
      '002_add_multi_tenancy.sql',
      '003_add_missing_columns.sql',
      '003_enable_rls.sql',
      '004_add_orders_missing_columns.sql',
      '005_add_coupons.sql',
      '006_add_order_coupon_fields.sql',
      '007_shipping_rates.sql',
      '008_add_users_last_login.sql',
      '009_carousel_images.sql',
      '009_section_content.sql',
      '010_add_carousel_fields.sql',
      '011_fix_utf8_encoding.sql',
      '012_fix_remaining_encoding.sql',
      '012_inventory_tables.sql',
      '013_add_testimonials_product_image.sql',
      '014_add_site_texts_tenant_id.sql',
      '015_consolidate_testimonial_image.sql',
      '016_add_hero_cards_descripcion.sql'
    ];

    for (const name of legacyMigrations) {
      const applied = await query('SELECT COUNT(*) AS count FROM migrations WHERE name = $1', [name]);
      if (applied.rows[0].count === 0) {
        await query(
          'INSERT INTO migrations (name) VALUES ($1) ON CONFLICT (name) DO NOTHING',
          [name]
        );
      }
    }
  } catch (err) {
    logger.debug({ err: err.message }, 'Error en repairMigrationConflicts (no crítico)');
  }
}

async function runMigrations(query, isLocalDb) {
  try {
    await ensureMigrationsTable(query);

    // Migrar desde pgmigrations si existe (unificación de sistemas)
    await migrateFromPgMigrations(query, isLocalDb);

    // Reparar conflictos de migraciones heredados antes de ejecutar las nuevas
    try {
      await repairMigrationConflicts(query, isLocalDb);
    } catch (err) {
      logger.warn({ err: err.message }, 'No se pudieron reparar conflictos de migraciones');
    }

    const applied = await getAppliedMigrations(query);

    if (!fs.existsSync(MIGRATIONS_DIR)) {
      return;
    }

    const files = fs.readdirSync(MIGRATIONS_DIR)
      .filter(f => f.endsWith('.sql') || f.endsWith('.js'))
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

    for (const file of files) {
      if (applied.has(file)) continue;

      const filePath = path.join(MIGRATIONS_DIR, file);
      let sql = '';

      if (!file.endsWith('.sql')) {
        logger.warn({ migration: file }, 'Migración no SQL omitida');
        continue;
      }

      sql = fs.readFileSync(filePath, 'utf8').trim();
      if (!sql) continue;

      try {
        await query(sql);
        await query('INSERT INTO migrations (name) VALUES ($1) ON CONFLICT (name) DO NOTHING', [file]);
        logger.info({ migration: file }, 'Migración aplicada');
      } catch (err) {
        logger.error({ migration: file, err: err.message }, 'Migración falló');
        throw new Error(`Migración ${file} falló: ${err.message}`);
      }
    }
  } catch (err) {
    logger.error({ err: err.message }, 'Error ejecutando migraciones');
    throw err;
  }
}

module.exports = { runMigrations };