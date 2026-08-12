const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const logger = require('../lib/logger');

const BACKUP_DIR = path.join(__dirname, '..', 'backups');
const MAX_BACKUPS = 10;

async function ensureBackupDir() {
  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
  }
}

async function backupSqlite() {
  await ensureBackupDir();
  const dbPath = process.env.DATABASE_PATH || path.join(__dirname, '..', 'data', 'iara.db');
  if (!fs.existsSync(dbPath)) {
    throw new Error(`SQLite database not found at ${dbPath}`);
  }
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const dest = path.join(BACKUP_DIR, `iara-${timestamp}.db`);
  fs.copyFileSync(dbPath, dest);
  await pruneBackups();
  return dest;
}

async function backupPostgres() {
  await ensureBackupDir();
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL is not set for PostgreSQL backup');
  }
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const dest = path.join(BACKUP_DIR, `iara-${timestamp}.sql`);
  await new Promise((resolve, reject) => {
    exec(`pg_dump "${connectionString}" > "${dest}"`, (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
  await pruneBackups();
  return dest;
}

async function pruneBackups() {
  const files = fs.readdirSync(BACKUP_DIR)
    .filter(f => f.startsWith('iara-') && (f.endsWith('.db') || f.endsWith('.sql')))
    .sort()
    .reverse();
  for (let i = MAX_BACKUPS; i < files.length; i++) {
    fs.unlinkSync(path.join(BACKUP_DIR, files[i]));
  }
}

async function runBackup() {
  try {
    const isLocal = !process.env.DATABASE_URL;
    const dest = isLocal ? await backupSqlite() : await backupPostgres();
    logger.info({ dest }, 'Backup created');
    console.log('Backup created at', dest);
    process.exit(0);
  } catch (err) {
    logger.error({ err: err.message }, 'Backup failed');
    console.error('Backup failed:', err.message);
    process.exit(1);
  }
}

if (require.main === module) {
  runBackup();
}

module.exports = { runBackup, backupSqlite, backupPostgres };
