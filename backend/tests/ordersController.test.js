jest.mock('../src/lib/db', () => ({
  query: jest.fn(),
  transaction: jest.fn((fn) => fn({ query: jest.fn().mockResolvedValue({ rows: [], rowCount: 0 }) }))
}));

jest.mock('../src/lib/logger', () => ({
  error: jest.fn(),
  warn: jest.fn(),
  info: jest.fn()
}));

jest.mock('../src/lib/parser', () => ({
  safeJsonParse: jest.fn((v, d) => (typeof v === 'string' ? JSON.parse(v || '{}') : (v || d)))
}));

jest.mock('../src/routes/sync', () => ({
  syncBus: { emit: jest.fn() }
}));

jest.mock('../src/lib/email', () => ({
  sendOrderConfirmationEmail: jest.fn().mockResolvedValue(true)
}));

jest.mock('fs', () => ({
  existsSync: jest.fn(() => true),
  mkdirSync: jest.fn(),
  createWriteStream: jest.fn(() => {
    const listeners = {};
    return {
      on: jest.fn((event, cb) => {
        listeners[event] = cb;
        if (event === 'finish') {
          Promise.resolve().then(() => listeners[event] && listeners[event]());
        }
      }),
      write: jest.fn(),
      end: jest.fn()
    };
  }),
  readFileSync: jest.fn(),
  unlinkSync: jest.fn()
}));

jest.mock('path', () => ({
  dirname: jest.fn(() => '/tmp'),
  basename: jest.fn((p) => p.split('/').pop()),
  extname: jest.fn(),
  join: jest.fn((...args) => args.join('/'))
}));

jest.mock('pdfkit', () => {
  const mockDoc = {
    fontSize: jest.fn(() => mockDoc),
    font: jest.fn(() => mockDoc),
    text: jest.fn(() => mockDoc),
    moveDown: jest.fn(() => mockDoc),
    pipe: jest.fn(() => mockDoc),
    end: jest.fn(() => mockDoc)
  };
  return jest.fn(() => mockDoc);
});

const { query, transaction } = require('../src/lib/db');
const { getOrders, getUserOrders, getOrderDetail, getPublicOrderTrack, createOrder, updateOrderStatus, deleteOrder, batchDeleteOrders, updateOrderNotes, getOrderReceipt, getOrderActivities, exportOrders, addOrderActivity } = require('../src/controllers/ordersController');

describe('ordersController', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    const mockedDb = require('../src/lib/db');
    mockedDb.transaction.mockImplementation((fn) => fn({ query: jest.fn().mockResolvedValue({ rows: [], rowCount: 0 }) }));
  });

  describe('getOrders', () => {
    test('retorna lista de pedidos con paginación', async () => {
      const req = { query: {} };
      const res = { json: jest.fn() };

      query.mockResolvedValueOnce({ rows: [{ total: '2' }], rowCount: 1 });
      query.mockResolvedValueOnce({ rows: [{ id: 1 }, { id: 2 }], rowCount: 2 });

      await getOrders(req, res);

      expect(res.json).toHaveBeenCalledWith({
        orders: [{ id: 1 }, { id: 2 }],
        total: 2,
        page: 1,
        pages: 1,
        hasMore: false
      });
    });

    test('filtra por status cuando se proporciona', async () => {
      const req = { query: { status: 'pending' } };
      const res = { json: jest.fn() };

      query.mockResolvedValueOnce({ rows: [{ total: '1' }], rowCount: 1 });
      query.mockResolvedValueOnce({ rows: [{ id: 1, status: 'pending' }], rowCount: 1 });

      await getOrders(req, res);

      expect(query.mock.calls[1][0]).toContain('status = $1');
      expect(query.mock.calls[1][1]).toEqual(expect.arrayContaining(['pending']));
    });

    test('filtra por rango de fechas', async () => {
      const req = { query: { start_date: '2024-01-01', end_date: '2024-01-31' } };
      const res = { json: jest.fn() };

      query.mockResolvedValueOnce({ rows: [{ total: '0' }], rowCount: 0 });
      query.mockResolvedValueOnce({ rows: [], rowCount: 0 });

      await getOrders(req, res);

      expect(query.mock.calls[1][0]).toContain('date(created_at) >= $1');
      expect(query.mock.calls[1][0]).toContain('date(created_at) <= $2');
    });

    test('maneja errores de base de datos', async () => {
      const req = { query: {} };
      const res = {
        status: jest.fn(() => res),
        json: jest.fn()
      };

      query.mockRejectedValueOnce(new Error('DB error'));

      await getOrders(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: 'Error interno del servidor' });
    });
  });

  describe('getUserOrders', () => {
    test('retorna pedidos por email', async () => {
      const req = { query: { email: 'test@example.com', access_token: 'valid-token' } };
      const res = {
        setHeader: jest.fn(),
        status: jest.fn(() => res),
        json: jest.fn()
      };

      query.mockResolvedValueOnce({ rows: [{ id: 1 }] });
      query.mockResolvedValueOnce({ rows: [{ id: 1 }] });

      await getUserOrders(req, res);

      expect(res.setHeader).toHaveBeenCalledWith('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
      expect(res.json).toHaveBeenCalledWith([{ id: 1 }]);
    });

    test('retorna 400 si falta email', async () => {
      const req = { query: { access_token: 'valid-token' } };
      const res = {
        status: jest.fn(() => res),
        json: jest.fn()
      };

      await getUserOrders(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'Email es requerido para buscar pedidos' });
    });

    test('retorna 401 si falta access_token', async () => {
      const req = { query: { email: 'test@example.com' } };
      const res = {
        status: jest.fn(() => res),
        json: jest.fn()
      };

      await getUserOrders(req, res);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: 'Token de acceso requerido' });
    });
  });

  describe('getOrderDetail', () => {
    test('retorna detalle del pedido', async () => {
      const req = { params: { id: 1 } };
      const res = {
        status: jest.fn(() => res),
        json: jest.fn()
      };

      query.mockResolvedValueOnce({ rows: [{ id: 1, total: 100 }] });

      await getOrderDetail(req, res);

      expect(res.json).toHaveBeenCalledWith({ id: 1, total: 100 });
    });

    test('retorna 404 si no existe', async () => {
      const req = { params: { id: 999 } };
      const res = {
        status: jest.fn(() => res),
        json: jest.fn()
      };

      query.mockResolvedValueOnce({ rows: [] });

      await getOrderDetail(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
    });

    test('maneja error de base de datos', async () => {
      const req = { params: { id: 1 } };
      const res = {
        status: jest.fn(() => res),
        json: jest.fn()
      };

      query.mockRejectedValueOnce(new Error('DB error'));

      await getOrderDetail(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  describe('addOrderActivity', () => {
    test('agrega actividad exitosamente', async () => {
      const req = {
        params: { id: 1 },
        body: { action: 'update', details: 'Cambio de estado' },
        user: { user: 'admin' },
        ip: '127.0.0.1',
        headers: {}
      };
      const res = { json: jest.fn() };

      query.mockResolvedValueOnce({ rows: [] });

      await addOrderActivity(req, res);

      expect(res.json).toHaveBeenCalledWith({ ok: true });
    });

    test('retorna 400 si falta action', async () => {
      const req = {
        params: { id: 1 },
        body: { details: 'Sin acción' },
        user: {},
        ip: '',
        headers: {}
      };
      const res = {
        status: jest.fn(() => res),
        json: jest.fn()
      };

      await addOrderActivity(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
    });
  });

  describe('getPublicOrderTrack', () => {
    test('retorna pedido público sin datos sensibles', async () => {
      const req = { params: { id: 1 }, headers: {}, query: { order_token: 'valid-token' } };
      const res = {
        setHeader: jest.fn(),
        status: jest.fn(() => res),
        json: jest.fn()
      };

      query.mockResolvedValueOnce({ rows: [{ id: 1, order_token: 'valid-token', items: '[]', total: 100, status: 'pending', shipping_name: 'Test', created_at: '2024-01-01' }] });
      query.mockResolvedValueOnce({ rows: [{ id: 1, order_token: 'valid-token', items: '[]', total: 100, status: 'pending', shipping_name: 'Test', shipping_phone: '123', shipping_email: 'test@example.com', created_at: '2024-01-01' }] });

      await getPublicOrderTrack(req, res);

      expect(res.setHeader).toHaveBeenCalledWith('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
      expect(res.json).toHaveBeenCalled();
    });

    test('retorna 401 si falta order_token', async () => {
      const req = { params: { id: 1 }, headers: {}, query: {} };
      const res = {
        status: jest.fn(() => res),
        json: jest.fn()
      };

      await getPublicOrderTrack(req, res);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: 'Token de acceso requerido' });
    });
  });

  describe('createOrder', () => {
    test('retorna 400 si falla la validación', async () => {
      const req = { body: { items: [], total: 0, customer: {} } };
      const res = {
        status: jest.fn(() => res),
        json: jest.fn()
      };

      await createOrder(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: expect.any(String) });
    });

    test('retorna 400 si faltan items o total', async () => {
      const req = { body: { items: [], total: 100, customer: {} } };
      const res = {
        status: jest.fn(() => res),
        json: jest.fn()
      };

      await createOrder(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: expect.stringContaining('Items') });
    });

    test('retorna orden existente si se proporciona idempotency_key', async () => {
      const req = {
        body: {
          items: [{ id: 1, name: 'Producto', price: 100, quantity: 1 }],
          total: 100,
          customer: { name: 'Test' },
          idempotency_key: 'abc-123'
        }
      };
      const res = {
        status: jest.fn(() => res),
        json: jest.fn()
      };

      query.mockResolvedValueOnce({ rows: [{ id: 1, status: 'pending' }] });

      await createOrder(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ id: 1, cached: true }));
    });

    test('crea orden exitosamente con cálculo de envío y cupón', async () => {
      const req = {
        body: {
          items: [{ id: 1, name: 'Producto', price: 100, quantity: 2 }],
          total: 250,
          customer: { name: 'Test', email: 'test@example.com' },
          shipping_name: 'Test',
          shipping_address: 'Calle 1',
          shipping_phone: '1234567890',
          shipping_city: 'Buenos Aires',
          shipping_cost: 50,
          couponCode: 'DESC10'
        },
        ip: '127.0.0.1',
        headers: {}
      };
      const res = {
        status: jest.fn(() => res),
        json: jest.fn()
      };

      query.mockResolvedValueOnce({ rows: [{ id: 1, price: 100 }] });
      query.mockResolvedValueOnce({ rows: [] });
      query.mockResolvedValueOnce({ rows: [{ shipping_cost: 50, free_shipping_from: 2000, included_shipping_cost: 0 }] });
      query.mockResolvedValueOnce({ rows: [{ id: 1, code: 'DESC10', type: 'fixed', value: 50, active: true, expires_at: null, max_uses: 0, used_count: 0, min_amount: 0 }] });
      query.mockResolvedValueOnce({ rows: [{ stock: 10 }] });
      query.mockResolvedValueOnce({ rows: [{ id: 1 }] });
      query.mockResolvedValueOnce({ rows: [{ id: 1, code: 'DESC10', type: 'fixed', value: 50, active: true, expires_at: null, max_uses: 0, used_count: 0, min_amount: 0 }] });
      query.mockResolvedValueOnce({ rows: [{ id: 1 }] });
      query.mockResolvedValueOnce({ rows: [{ id: 1, status: 'pending' }] });
      query.mockResolvedValueOnce({ rows: [] });

      await createOrder(req, res);

      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalled();
    });

    test('falla cuando el producto no existe', async () => {
      const req = {
        body: {
          items: [{ id: 999, name: 'Producto', price: 100, quantity: 1 }],
          total: 100,
          customer: { name: 'Test' }
        }
      };
      const res = {
        status: jest.fn(() => res),
        json: jest.fn()
      };

      query.mockResolvedValueOnce({ rows: [] });

      await createOrder(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: expect.stringContaining('Producto 999 no encontrado') });
    });

    test('falla cuando no hay stock suficiente', async () => {
      const req = {
        body: {
          items: [{ id: 1, name: 'Producto', price: 100, quantity: 5 }],
          total: 500,
          customer: { name: 'Test' }
        }
      };
      const res = {
        status: jest.fn(() => res),
        json: jest.fn()
      };

      query.mockResolvedValueOnce({ rows: [{ id: 1, price: 100 }] });
      query.mockResolvedValueOnce({ rows: [] });
      query.mockResolvedValueOnce({ rows: [{ stock: 2 }] });

      await createOrder(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: expect.stringContaining('Stock insuficiente') });
    });

    test('maneja error de base de datos', async () => {
      const req = {
        body: {
          items: [{ id: 1, name: 'Producto', price: 100, quantity: 1 }],
          total: 100,
          customer: { name: 'Test' }
        }
      };
      const res = {
        status: jest.fn(() => res),
        json: jest.fn()
      };

      query.mockRejectedValueOnce(new Error('DB error'));

      await createOrder(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'DB error' });
    });
  });

  describe('updateOrderStatus', () => {
    test('retorna 400 si el estado es inválido', async () => {
      const req = { params: { id: 1 }, body: { status: 'invalid' }, user: {}, ip: '', headers: {} };
      const res = {
        status: jest.fn(() => res),
        json: jest.fn()
      };

      await updateOrderStatus(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: expect.stringContaining('Estado inválido') });
    });

    test('retorna 404 si el pedido no existe', async () => {
      const req = { params: { id: 999 }, body: { status: 'confirmed' }, user: {}, ip: '', headers: {} };
      const res = {
        status: jest.fn(() => res),
        json: jest.fn()
      };

      query.mockResolvedValueOnce({ rows: [] });

      await updateOrderStatus(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ error: 'Pedido no encontrado' });
    });

    test('actualiza estado y restaura stock si se cancela', async () => {
      const req = {
        params: { id: 1 },
        body: { status: 'cancelled' },
        user: { user: 'admin' },
        ip: '127.0.0.1',
        headers: {}
      };
      const res = {
        status: jest.fn(() => res),
        json: jest.fn()
      };

      query.mockResolvedValueOnce({ rows: [{ id: 1, status: 'pending', items: JSON.stringify([{ id: 1, quantity: 2 }]) }] });
      query.mockResolvedValueOnce({ rows: [] });
      query.mockResolvedValueOnce({ rows: [{ id: 1, status: 'cancelled' }] });
      query.mockResolvedValueOnce({ rows: [] });

      await updateOrderStatus(req, res);

      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ id: 1, status: 'cancelled' }));
      expect(query).toHaveBeenNthCalledWith(2, 'UPDATE products SET stock = stock + $1 WHERE id = $2 AND (tenant_id = current_setting(\'app.current_tenant\', TRUE) OR tenant_id = \'default\')', [2, 1], undefined);
    });

    test('maneja error de base de datos', async () => {
      const req = { params: { id: 1 }, body: { status: 'confirmed' }, user: {}, ip: '', headers: {} };
      const res = {
        status: jest.fn(() => res),
        json: jest.fn()
      };

      query.mockRejectedValueOnce(new Error('DB error'));

      await updateOrderStatus(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: 'Error interno del servidor' });
    });
  });

  describe('deleteOrder', () => {
    test('retorna 404 si el pedido no existe', async () => {
      const req = { params: { id: 999 }, user: {}, ip: '', headers: {} };
      const res = {
        status: jest.fn(() => res),
        json: jest.fn()
      };

      query.mockResolvedValueOnce({ rows: [] });

      await deleteOrder(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ error: 'Pedido no encontrado' });
    });

    test('elimina pedido y restaura stock', async () => {
      const req = {
        params: { id: 1 },
        user: { user: 'admin' },
        ip: '127.0.0.1',
        headers: {}
      };
      const res = { json: jest.fn() };

      query.mockResolvedValueOnce({ rows: [{ id: 1, status: 'pending', items: JSON.stringify([{ id: 1, quantity: 2 }]) }] });
      query.mockResolvedValueOnce({ rows: [] });
      query.mockResolvedValueOnce({ rows: [] });

      await deleteOrder(req, res);

      expect(res.json).toHaveBeenCalledWith({ ok: true });
      expect(query).toHaveBeenNthCalledWith(3, 'DELETE FROM orders WHERE id = $1 AND (tenant_id = current_setting(\'app.current_tenant\', TRUE) OR tenant_id = \'default\')', [1], expect.anything());
    });
  });

  describe('batchDeleteOrders', () => {
    test('retorna 400 si falta el estado', async () => {
      const req = { body: {}, user: {}, ip: '', headers: {} };
      const res = {
        status: jest.fn(() => res),
        json: jest.fn()
      };

      await batchDeleteOrders(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'Estado inválido para eliminación en lote' });
    });

    test('elimina todos los pedidos del estado especificado', async () => {
      const req = {
        body: { status: 'cancelled' },
        user: { user: 'admin' },
        ip: '127.0.0.1',
        headers: {}
      };
      const res = { json: jest.fn() };

      query.mockImplementation(function(sql, params) {
        if (sql.indexOf('SELECT') === 0 && sql.indexOf('orders') !== -1) {
          return Promise.resolve({ rows: [
            { id: 1, status: 'cancelled', items: JSON.stringify([{ id: 1, quantity: 2 }]) },
            { id: 2, status: 'cancelled', items: JSON.stringify([{ id: 2, quantity: 1 }]) }
          ] });
        }
        if (sql.indexOf('UPDATE products') === 0) {
          return Promise.resolve({ rows: [] });
        }
        if (sql.indexOf('INSERT INTO activity_log') === 0) {
          return Promise.resolve({ rows: [] });
        }
        if (sql.indexOf('DELETE FROM orders') === 0) {
          return Promise.resolve({ rowCount: 2 });
        }
        return Promise.resolve({ rows: [], rowCount: 0 });
      });

      await batchDeleteOrders(req, res);

      expect(res.json).toHaveBeenCalledWith({ ok: true, deleted: 2 });
      expect(query).toHaveBeenCalledWith('DELETE FROM orders WHERE status = $1 AND (tenant_id = current_setting(\'app.current_tenant\', TRUE) OR tenant_id = \'default\')', ['cancelled'], expect.anything());
    });

    test('maneja error de base de datos', async () => {
      const req = { body: { status: 'cancelled' }, user: {}, ip: '', headers: {} };
      const res = {
        status: jest.fn(() => res),
        json: jest.fn()
      };

      query.mockRejectedValueOnce(new Error('DB error'));

      await batchDeleteOrders(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: 'Error interno del servidor' });
    });
  });

  describe('updateOrderNotes', () => {
    test('retorna 404 si el pedido no existe', async () => {
      const req = { params: { id: 999 }, body: { notes: 'Nota' }, user: {}, ip: '', headers: {} };
      const res = {
        status: jest.fn(() => res),
        json: jest.fn()
      };

      query.mockResolvedValueOnce({ rows: [] });

      await updateOrderNotes(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
    });

    test('actualiza notas correctamente', async () => {
      const req = {
        params: { id: 1 },
        body: { notes: 'Nota actualizada' },
        user: { user: 'admin' },
        ip: '127.0.0.1',
        headers: {}
      };
      const res = {
        status: jest.fn(() => res),
        json: jest.fn()
      };

      query.mockResolvedValueOnce({ rows: [{ id: 1, notes: 'Nota actualizada' }] });
      query.mockResolvedValueOnce({ rows: [] });

      await updateOrderNotes(req, res);

      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ id: 1, notes: 'Nota actualizada' }));
    });
  });

  describe('getOrderReceipt', () => {
    test('retorna objeto vacío si no existe receipt', async () => {
      const req = { params: { id: 1 } };
      const res = { json: jest.fn() };

      query.mockResolvedValueOnce({ rows: [] });

      await getOrderReceipt(req, res);

      expect(res.json).toHaveBeenCalledWith({});
    });

    test('retorna receipt cuando existe', async () => {
      const req = { params: { id: 1 } };
      const res = { json: jest.fn() };

      query.mockResolvedValueOnce({ rows: [{ id: 1, order_id: 1 }] });

      await getOrderReceipt(req, res);

      expect(res.json).toHaveBeenCalledWith({ id: 1, order_id: 1 });
    });
  });

  describe('getOrderActivities', () => {
    test('retorna actividades del pedido', async () => {
      const req = { params: { id: 1 } };
      const res = { json: jest.fn() };

      query.mockResolvedValueOnce({ rows: [{ id: 1, action: 'update' }] });

      await getOrderActivities(req, res);

      expect(res.json).toHaveBeenCalledWith({ activities: [{ id: 1, action: 'update' }] });
    });
  });

  describe('exportOrders', () => {
    test('exporta CSV exitosamente', async () => {
      const req = { query: { format: 'csv' } };
      const res = {
        setHeader: jest.fn(),
        send: jest.fn()
      };

      query.mockResolvedValueOnce({ rows: [{ id: 1, customer: JSON.stringify({ name: 'Test', email: 'test@example.com' }), total: 100, status: 'pending', payment_method: 'transfer', created_at: '2024-01-01T00:00:00.000Z' }] });

      await exportOrders(req, res);

      expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'text/csv; charset=utf-8');
      expect(res.send).toHaveBeenCalled();
    });

    test('maneja error en exportación', async () => {
      const req = { query: {} };
      const res = {
        status: jest.fn(() => res),
        json: jest.fn()
      };

      query.mockRejectedValueOnce(new Error('DB error'));

      await exportOrders(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: 'Error interno del servidor' });
    });
  });
});
