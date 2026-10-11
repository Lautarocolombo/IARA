const fs = require('fs');
const path = require('path');

jest.mock('../src/lib/logger', () => ({
  error: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn()
}));

const migrationsDir = path.join(__dirname, '..', 'migrations');
const migrationFiles = ['001_init_schema.sql', '002_add_order_token.sql'];

describe('SQL migration registry', () => {
  let migrator;
  let existsSync;
  let readdirSync;
  let readFileSync;

  beforeEach(() => {
    jest.resetModules();
    existsSync = jest.spyOn(fs, 'existsSync').mockImplementation(target =>
      target === migrationsDir ? true : false
    );
    readdirSync = jest.spyOn(fs, 'readdirSync').mockImplementation(target =>
      target === migrationsDir ? migrationFiles : []
    );
    readFileSync = jest.spyOn(fs, 'readFileSync').mockImplementation(target =>
      migrationFiles.includes(path.basename(target)) ? `-- ${path.basename(target)}` : ''
    );
    migrator = require('../src/lib/migrator');
  });

  afterEach(() => {
    existsSync.mockRestore();
    readdirSync.mockRestore();
    readFileSync.mockRestore();
  });

  test('preserves legacy records and only executes unrecorded file migrations', async () => {
    const existingNames = new Set(['001_add_order_token']);
    const query = jest.fn(async (sql, params) => {
      if (sql.startsWith('SELECT name FROM migrations')) {
        return { rows: [...existingNames].map(name => ({ name })) };
      }
      if (sql.startsWith('INSERT INTO migrations')) {
        existingNames.add(params[0]);
      }
      return { rows: [], rowCount: 1 };
    });

    await migrator.runMigrations(query);

    expect(existingNames).toEqual(new Set(['001_add_order_token', '001_init_schema.sql', '002_add_order_token.sql']));
    expect(query.mock.calls.some(([sql]) => /\bDELETE\b/i.test(sql))).toBe(false);
    expect(query.mock.calls.filter(([sql]) => sql.startsWith('INSERT INTO migrations'))).toEqual([
      ['INSERT INTO migrations (name) VALUES ($1) ON CONFLICT (name) DO NOTHING', ['001_init_schema.sql']],
      ['INSERT INTO migrations (name) VALUES ($1) ON CONFLICT (name) DO NOTHING', ['002_add_order_token.sql']]
    ]);
  });

  test('reports pending migrations without modifying the registry', async () => {
    const query = jest.fn().mockResolvedValue({ rows: [{ name: '001_init_schema.sql' }] });

    await expect(migrator.checkMigrations(query)).resolves.toEqual(['002_add_order_token.sql']);
    expect(query).toHaveBeenCalledTimes(1);
  });
});
