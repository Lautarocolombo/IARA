jest.mock('../src/lib/db', () => ({
  query: jest.fn(),
  transaction: jest.fn(),
  isLocal: false
}));

jest.mock('../src/lib/logger', () => ({
  error: jest.fn(),
  warn: jest.fn(),
  info: jest.fn()
}));

jest.mock('../src/lib/audit', () => ({
  logAudit: jest.fn(() => Promise.resolve())
}));

describe('historyController clearHistory', () => {
  let query;
  let db;
  let clearHistory;

  beforeEach(() => {
    jest.resetModules();
    query = jest.fn();
    db = require('../src/lib/db');
    db.query = query;
    db.transaction = jest.fn(async (fn) => fn({ query }));
    const controller = require('../src/controllers/historyController');
    clearHistory = controller.clearHistory;
  });

  test('elimina historial correctamente', async () => {
    const req = { user: { user: 'admin', tenant_id: 'default' }, ip: '', headers: {} };
    const res = {
      status: jest.fn(() => res),
      json: jest.fn()
    };

    query.mockResolvedValue({ rowCount: 5 });
    query.mockResolvedValue({ rowCount: 3 });
    query.mockResolvedValue({ rowCount: 2 });
    query.mockResolvedValue({ rowCount: 10 });
    query.mockResolvedValue({ rowCount: 8 });

    await clearHistory(req, res);

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ ok: true })
    );
  });

  test('maneja error de base de datos', async () => {
    const req = { user: { user: 'admin', tenant_id: 'default' }, ip: '', headers: {} };
    const res = {
      status: jest.fn(() => res),
      json: jest.fn()
    };

    query.mockRejectedValueOnce(new Error('DB error'));

    await clearHistory(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
  });
});