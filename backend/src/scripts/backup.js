const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
const logger = require('../lib/logger');

const BACKUP_DIR = path.join(__dirname, '..', '..', 'backups');
const MAX_BACKUPS = 7;
const TABLES = [
  'products',
  'product_images',
  'categories',
  'orders',
  'testimonials',
  'hero_cards',
  'webhook_events',
  'receipts'
];

async function backupDatabase() {
  const databaseUrl = process.env.DATABASE_URL;
  
  if (!databaseUrl) {
    logger.warn('DATABASE_URL no configurada, saltando backup');
    console.error('ERROR: DATABASE_URL no configurada');
    process.exit(1);
  }

  const pool = new Pool({ 
    connectionString: databaseUrl,
    max: 5,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000
  });
  
  try {
    if (!fs.existsSync(BACKUP_DIR)) {
      fs.mkdirSync(BACKUP_DIR, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFile = path.join(BACKUP_DIR, `backup-${timestamp}.sql`);

    logger.info('Iniciando backup de base de datos...');
    let sql = `-- Backup generado automáticamente: ${new Date().toISOString()}\n`;
    sql += `-- Base de datos: ${databaseUrl.replace(/:.*@/, ':****@')}\n\n`;

    for (const table of TABLES) {
      try {
        const result = await pool.query(`SELECT * FROM ${table}`);
        if (result.rows.length > 0) {
          sql += `-- Tabla: ${table} (${result.rows.length} registros)\n`;
          sql += `DELETE FROM ${table} CASCADE;\n\n`;
          
          for (const row of result.rows) {
            const columns = Object.keys(row).join(', ');
            const values = Object.values(row).map(v => {
              if (v === null) return 'NULL';
              if (typeof v === 'string') return `'${v.replace(/'/g, '\'\'')}'`;
              if (v instanceof Date) return `'${v.toISOString()}'`;
              if (Buffer.isBuffer(v)) return `'${v.toString('base64')}'::bytea`;
              if (typeof v === 'boolean') return v ? 'TRUE' : 'FALSE';
              return v;
            }).join(', ');
            sql += `INSERT INTO ${table} (${columns}) VALUES (${values});\n`;
          }
          sql += '\n';
          logger.info(`Tabla ${table}: ${result.rows.length} registros respaldados`);
        }
      } catch (err) {
        logger.warn({ table, err: err.message }, 'Error haciendo backup de tabla');
      }
    }

    fs.writeFileSync(backupFile, sql, { mode: 0o600 });
    const stats = fs.statSync(backupFile);
    logger.info({ backupFile, size: stats.size, rows: sql.split('\n').length }, 'Backup completado');

    const files = fs.readdirSync(BACKUP_DIR)
      .filter(f => f.startsWith('backup-') && f.endsWith('.sql'))
      .sort()
      .reverse();
    
    if (files.length > MAX_BACKUPS) {
      for (let i = MAX_BACKUPS; i < files.length; i++) {
        try {
          fs.unlinkSync(path.join(BACKUP_DIR, files[i]));
          logger.info({ file: files[i] }, 'Backup antiguo eliminado');
        } catch (err) {
          logger.warn({ file: files[i], err: err.message }, 'Error eliminando backup antiguo');
        }
      }
    }

    await pool.end();
    logger.info('Backup finalizado correctamente');
    process.exit(0);
  } catch (err) {
    logger.error({ err: err.message, stack: err.stack }, 'Error en backup de base de datos');
    console.error('ERROR en backup:', err);
    try {
      await pool.end();
    } catch (e) {
      // ignore
    }
    process.exit(1);
  }
}

if (require.main === module) {
  backupDatabase();
}

module.exports = { backupDatabase };
