import fs from 'fs';
import path from 'path';
import logger from '../logger';

let sqlite3: any = null;
try {
  sqlite3 = require('sqlite3').verbose();
} catch (err: unknown) {
  logger.error({ err: (err as Error).message }, 'Error cargando sqlite3');
  sqlite3 = null;
}

const connectionString: string | undefined = process.env.DATABASE_URL;
const isLocal: boolean = !connectionString;

let db: any = null;
let pool: any = null;

interface PoolConfig {
  connectionString: string;
  ssl: boolean | { rejectUnauthorized: boolean };
  max: number;
  idleTimeoutMillis: number;
  connectionTimeoutMillis: number;
  allowExitOnIdle: boolean;
}

function createPool(connString: string): any {
  const { Pool } = require('pg');
  let finalConnectionString = connString;

  if (process.env.NODE_ENV === 'production' && connString && !connString.includes('sslmode=')) {
    const separator = connString.includes('?') ? '&' : '?';
    finalConnectionString = connString + separator + 'sslmode=require';
  }
  if (finalConnectionString && !finalConnectionString.includes('uselibpqcompat=')) {
    const separator = finalConnectionString.includes('?') ? '&' : '?';
    finalConnectionString = finalConnectionString + separator + 'uselibpqcompat=true';
  }
  if (finalConnectionString && !finalConnectionString.includes('client_encoding=')) {
    const separator = finalConnectionString.includes('?') ? '&' : '?';
    finalConnectionString = finalConnectionString + separator + 'client_encoding=UTF8';
  }

  const poolConfig: PoolConfig = {
    connectionString: finalConnectionString,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
    allowExitOnIdle: false
  };

  const newPool = new Pool(poolConfig);

  newPool.on('acquire', () => {
    if (newPool.waitingCount > 5) {
      logger.warn(
        { total: newPool.totalCount, idle: newPool.idleCount, waiting: newPool.waitingCount },
        'Pool cerca del agotamiento'
      );
    }
  });

  newPool.on('error', (err: Error) => {
    logger.error({ err: err.message }, 'Error inesperado en pool de conexiones');
  });

  return newPool;
}

async function waitForPool(poolInstance: any, retries = 5, delay = 1000): Promise<any> {
  for (let i = 0; i < retries; i++) {
    try {
      const client = await poolInstance.connect();
      client.release();
      return poolInstance;
    } catch (err) {
      logger.warn({ attempt: i + 1, err: (err as Error).message }, 'Pool no listo, reintentando...');
      if (i === retries - 1) throw err;
      await new Promise(resolve => setTimeout(resolve, delay * Math.pow(2, i)));
    }
  }
}

if (isLocal) {
  if (!sqlite3) {
    logger.error('sqlite3 no está disponible. Verificá que esté instalado correctamente.');
  } else {
    const dbDir = process.env.VERCEL
      ? '/tmp/ag-data'
      : path.join(__dirname, '..', '..', '..', 'data');
    const dbPath = path.join(dbDir, 'iara.db');
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }
    db = new sqlite3.Database(dbPath);
  }
} else {
  (async () => {
    try {
      pool = createPool(connectionString as string);
      pool.on('error', (err: Error) => {
        logger.error({ err: err.message }, 'Pool error');
      });

      await waitForPool(pool);
      logger.info('Pool de PostgreSQL inicializado correctamente');
    } catch (err) {
      logger.error({ err: (err as Error).message, stack: (err as Error).stack }, 'Error inicializando pool de PostgreSQL');
    }
  })();
}

function getDb(): any {
  return db;
}

function getPool(): any {
  return pool;
}

function getIsLocal(): boolean {
  return isLocal;
}

async function closeDB(): Promise<void> {
  if (pool && typeof pool.end === 'function') {
    try {
      await pool.end();
    } catch {
      // noop
    }
  }
  if (isLocal && db && typeof db.close === 'function') {
    try {
      await new Promise<void>((resolve, reject) => {
        db.close((err: Error | null) => err ? reject(err) : resolve());
      });
    } catch {
      // noop
    }
  }
}

export { getDb, getPool, getIsLocal, closeDB, waitForPool, createPool };