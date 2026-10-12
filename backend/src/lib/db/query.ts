import { getDb, getPool, getIsLocal } from './pool';
import logger from '../logger';

function toSqlite(sql: string): string {
  return sql
    .replace(/\$\d+/g, '?')
    .replace(/SERIAL PRIMARY KEY/g, 'INTEGER PRIMARY KEY AUTOINCREMENT')
    .replace(/JSONB/g, 'TEXT')
    .replace(/TIMESTAMP DEFAULT CURRENT_TIMESTAMP/g, 'DATETIME DEFAULT CURRENT_TIMESTAMP')
    .replace(/ON CONFLICT \((.+?)\) DO UPDATE SET/gi, (match: string, col: string) => `ON CONFLICT(${col}) DO UPDATE SET`);
}

function isRetryableError(err: any): boolean {
  const retryableCodes = ['ECONNRESET', 'ETIMEDOUT', 'ECONNREFUSED', 'EHOSTUNREACH', 'ENETUNREACH', 'EPIPE'];
  const retryablePgCodes = ['57P03', '57P01', '55P03', '40001', '40P01', '08003', '08006', '08001', '08007'];
  if (!err.code) return true;
  if (retryableCodes.includes(err.code)) return true;
  if (retryablePgCodes.includes(err.code)) return true;
  return false;
}

interface QueryResult {
  rows: any[];
  rowCount: number;
}

interface QueryOptions {
  text: string;
  params?: any[];
  transactionClient?: any;
}

async function query(text: string, params?: any[], transactionClient?: any): Promise<QueryResult> {
  const client = transactionClient || getPool();
  const isLocal = getIsLocal();

  if (!client && isLocal) {
    const db = getDb();
    return new Promise<QueryResult>((resolve, reject) => {
      let sql = text;
      if (isLocal) {
        sql = sql.replace(/current_setting\('app\.current_tenant',\s*TRUE\)/gi, "'default'");
      }
      const sqliteSql = toSqlite(sql);
      const values = params || [];
      const trimmed = sqliteSql.trim().toUpperCase();
      if (trimmed.startsWith('SELECT') || trimmed.startsWith('WITH') || trimmed.startsWith('PRAGMA') || sqliteSql.toUpperCase().includes('RETURNING')) {
        db.all(sqliteSql, values, (err: Error | null, rows: any[]) => {
          if (err) return reject(err);
          resolve({ rows, rowCount: rows ? rows.length : 0 });
        });
      } else {
        db.run(sqliteSql, values, function (this: { changes: number }, err: Error | null) {
          if (err) return reject(err);
          resolve({ rows: [], rowCount: this.changes || 0 });
        });
      }
    });
  }

  if (!client) {
    throw new Error('No hay conexión a base de datos disponible');
  }

  const start = Date.now();
  const maxRetries = 3;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const result = await client.query(text, params);
      const duration = Date.now() - start;
      logger.debug({ duration, rows: result.rowCount }, 'Query ejecutada');
      return result;
    } catch (err) {
      const isFinalAttempt = attempt === maxRetries;
      const isRetryable = isRetryableError(err);

      logger.error({ err: (err as Error).message, sql: text.substring(0, 200), attempt: attempt + 1, retryable: isRetryable }, 'Error en query');

      if (isFinalAttempt || !isRetryable) {
        throw err;
      }

      const backoff = Math.pow(2, attempt) * 1000;
      logger.warn({ attempt: attempt + 1, backoff }, 'Reintentando query...');
      await new Promise(resolve => setTimeout(resolve, backoff));
    }
  }
  throw new Error('Query failed after max retries');
}

async function getClient(): Promise<any> {
  const pool = getPool();
  if (!pool) throw new Error('Pool no inicializado');
  return await pool.connect();
}

async function transaction(fn: (client: any) => Promise<any>): Promise<any> {
  const isLocal = getIsLocal();
  const db = getDb();

  if (isLocal) {
    return new Promise((resolve, reject) => {
      db.serialize(() => {
        db.run('BEGIN', (err: Error | null) => {
          if (err) return reject(err);
          const run = (sql: string, params?: any[]) => {
            return new Promise((res, rej) => {
              let sqlite = toSqlite(sql);
              if (isLocal) {
                sqlite = sqlite.replace(/current_setting\('app\.current_tenant',\s*TRUE\)/gi, "'default'");
              }
              const trimmed = sqlite.trim().toUpperCase();
              if (trimmed.startsWith('SELECT') || trimmed.startsWith('WITH') || trimmed.startsWith('PRAGMA')) {
                db.all(sqlite, params, (e: Error | null, rows: any[]) => {
                  if (e) return rej(e);
                  res({ rows, rowCount: rows ? rows.length : 0 });
                });
              } else {
                db.run(sqlite, params, function (this: { changes: number }, e: Error | null) {
                  if (e) return rej(e);
                  res({ rows: [], rowCount: this.changes || 0 });
                });
              }
            });
          };
          const client = { query: run };
          fn(client)
            .then(result => {
              db.run('COMMIT', (err: Error | null) => {
                if (err) return reject(err);
                resolve(result);
              });
            })
            .catch(err => {
              db.run('ROLLBACK', () => reject(err));
            });
        });
      });
    });
  }

  const client = await getClient();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export { query, transaction, getClient, toSqlite, isRetryableError };
export type { QueryResult };