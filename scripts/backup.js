const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');

const DB_DIR = process.env.VERCEL ? '/tmp/ag-data' : path.join(__dirname, '..', '..', 'data');
const DB_PATH = path.join(DB_DIR, 'iara.db');
const BACKUP_DIR = path.join(DB_DIR, 'backups');

if (!fs.existsSync(BACKUP_DIR)) {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
}

function backup() {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = path.join(BACKUP_DIR, `iara-backup-${timestamp}.db`);
  try {
    if (fs.existsSync(DB_PATH)) {
      fs.copyFileSync(DB_PATH, backupPath);
      console.log(`Backup creado: ${backupPath}`);
      const files = fs.readdirSync(BACKUP_DIR).filter(f => f.endsWith('.db'));
      if (files.length > 10) {
        files.sort().slice(0, files.length - 10).forEach(f => {
          fs.unlinkSync(path.join(BACKUP_DIR, f));
          console.log(`Backup antiguo eliminado: ${f}`);
        });
      }
    } else {
      console.log('No se encontró la base de datos para respaldar');
    }
  } catch (err) {
    console.error('Error creando backup:', err.message);
  }
}

backup();