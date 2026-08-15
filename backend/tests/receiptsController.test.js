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

jest.mock('pdfkit', () => jest.fn(() => ({
  fontSize: jest.fn().mockReturnThis(),
  font: jest.fn().mockReturnThis(),
  text: jest.fn().mockReturnThis(),
  moveDown: jest.fn().mockReturnThis(),
  pipe: jest.fn().mockReturnThis(),
  end: jest.fn().mockReturnThis()
})));

const fs = require('fs');
const path = require('path');
const { query } = require('../src/lib/db');
const { generateReceiptPDF, sendReceiptWhatsApp, uploadReceipt } = require('../src/controllers/receiptsController');

function createSyncThenable(result) {
  const promise = Promise.resolve(result);
  promise.then = (onFulfilled) => {
    onFulfilled(result);
    return promise;
  };
  return promise;
}

function createRejectedThenable(error) {
  return {
    then(onFulfilled, onRejected) {
      if (typeof onRejected === 'function') {
        onRejected(error);
      }
      return Promise.reject(error);
    }
  };
}

describe('receiptsController', () => {
  beforeEach(() => {
    query.mockReset();
    fs.createWriteStream = jest.fn(() => ({
      on: jest.fn((event, cb) => { if (event === 'finish') cb(); })
    }));
    fs.existsSync = jest.fn(() => true);
    fs.mkdirSync = jest.fn();
    fs.copyFileSync = jest.fn();
    fs.unlinkSync = jest.fn();
  });

  describe('generateReceiptPDF', () => {
    test('genera PDF y lo descarga', async () => {
      const req = { params: { id: 1 } };
      const res = {
        status: jest.fn(() => res),
        json: jest.fn(),
        download: jest.fn()
      };

      query.mockReturnValueOnce(createSyncThenable({
        rows: [
          {
            id: 1,
            customer: JSON.stringify({ name: 'Juan', email: 'juan@test.com', phone: '123', address: 'Calle 1' }),
            items: JSON.stringify([{ name: 'Pulsera', quantity: 2, price: 100 }]),
            total: 200,
            subtotal: 180,
            shipping_cost: 20,
            status: 'confirmed',
            created_at: '2024-01-01'
          }
        ]
      }));
      query.mockReturnValueOnce(createSyncThenable({ rows: [] }));

      await generateReceiptPDF(req, res);

      expect(fs.createWriteStream).toHaveBeenCalled();
      const stream = fs.createWriteStream.mock.results[0].value;
      expect(stream.on).toHaveBeenCalledWith('finish', expect.any(Function));
      expect(query.mock.calls.length).toBe(2);
      expect(res.download).toHaveBeenCalledWith(
        expect.stringContaining('comprobante-pedido-1.pdf'),
        'comprobante-pedido-1.pdf'
      );
    });

    test('guarda receipt en BD', async () => {
      const req = { params: { id: 1 } };
      const res = {
        status: jest.fn(() => res),
        json: jest.fn(),
        download: jest.fn()
      };

      query.mockReturnValueOnce(createSyncThenable({
        rows: [
          {
            id: 1,
            customer: JSON.stringify({ name: 'Juan' }),
            items: JSON.stringify([{ name: 'Pulsera', quantity: 1, price: 100 }]),
            total: 100,
            subtotal: 100,
            shipping_cost: 0,
            status: 'confirmed',
            created_at: '2024-01-01'
          }
        ]
      }));
      query.mockReturnValueOnce(createSyncThenable({ rows: [] }));
      query.mockReturnValueOnce(createSyncThenable({ rows: [] }));

      await generateReceiptPDF(req, res);

      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO receipts'),
        expect.arrayContaining([1, expect.stringContaining('.pdf'), expect.any(String)])
      );
    });

    test('retorna 404 si pedido no existe', async () => {
      const req = { params: { id: 999 } };
      const res = {
        status: jest.fn(() => res),
        json: jest.fn()
      };

      query.mockResolvedValueOnce({ rows: [] });

      await generateReceiptPDF(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ error: 'Pedido no encontrado' });
    });

    test('continúa descargando si falla guardar receipt', async () => {
      const req = { params: { id: 1 } };
      const res = {
        status: jest.fn(() => res),
        json: jest.fn(),
        download: jest.fn()
      };

      query.mockReturnValueOnce(createSyncThenable({
        rows: [
          {
            id: 1,
            customer: JSON.stringify({ name: 'Juan' }),
            items: JSON.stringify([{ name: 'Pulsera' }]),
            total: 100,
            subtotal: 100,
            shipping_cost: 0,
            status: 'confirmed',
            created_at: '2024-01-01'
          }
        ]
      }));
      query.mockReturnValueOnce(createRejectedThenable(new Error('DB error')));

      await generateReceiptPDF(req, res);

      expect(res.download).toHaveBeenCalled();
    });

    test('retorna 500 en error de DB', async () => {
      const req = { params: { id: 1 } };
      const res = {
        status: jest.fn(() => res),
        json: jest.fn()
      };

      query.mockRejectedValueOnce(new Error('DB error'));

      await generateReceiptPDF(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: 'Error interno del servidor' });
    });
  });

  describe('sendReceiptWhatsApp', () => {
    test('envía enlace de WhatsApp', async () => {
      const req = { params: { id: 1 } };
      const res = {
        status: jest.fn(() => res),
        json: jest.fn()
      };

      query.mockResolvedValueOnce({
        rows: [
          {
            id: 1,
            customer: { phone: '5493444634444' },
            total: 1000
          }
        ]
      });
      query.mockResolvedValueOnce({ rows: [] });

      await sendReceiptWhatsApp(req, res);

      expect(query.mock.calls[0]).toEqual(['SELECT * FROM orders WHERE id = $1', [1]]);
      expect(query.mock.calls.length).toBeGreaterThanOrEqual(1);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          ok: true,
          whatsappUrl: expect.stringContaining('wa.me/5493444634444')
        })
      );
    });

    test('marca receipt como enviado por WhatsApp', async () => {
      const req = { params: { id: 1 } };
      const res = {
        status: jest.fn(() => res),
        json: jest.fn()
      };

      query.mockResolvedValueOnce({
        rows: [
          {
            id: 1,
            customer: { phone: '5493444634444' },
            total: 1000
          }
        ]
      });
      query.mockResolvedValueOnce({ rows: [] });

      await sendReceiptWhatsApp(req, res);

      expect(query).toHaveBeenCalledWith(
        'UPDATE receipts SET sent_whatsapp = TRUE WHERE order_id = $1',
        [1]
      );
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          ok: true,
          whatsappUrl: expect.stringContaining('wa.me/5493444634444')
        })
      );
    });

    test('retorna 400 si no hay teléfono', async () => {
      const req = { params: { id: 1 } };
      const res = {
        status: jest.fn(() => res),
        json: jest.fn()
      };

      query.mockResolvedValueOnce({
        rows: [
          {
            id: 1,
            customer: JSON.stringify({ phone: '' }),
            total: 1000
          }
        ]
      });

      await sendReceiptWhatsApp(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'El pedido no tiene teléfono de cliente' });
    });

    test('retorna 404 si pedido no existe', async () => {
      const req = { params: { id: 999 } };
      const res = {
        status: jest.fn(() => res),
        json: jest.fn()
      };

      query.mockResolvedValueOnce({ rows: [] });

      await sendReceiptWhatsApp(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ error: 'Pedido no encontrado' });
    });

    test('retorna 500 en error de DB', async () => {
      const req = { params: { id: 1 } };
      const res = {
        status: jest.fn(() => res),
        json: jest.fn()
      };

      query.mockRejectedValueOnce(new Error('DB error'));

      await sendReceiptWhatsApp(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: 'Error interno del servidor' });
    });
  });

  describe('uploadReceipt', () => {
    test('sube comprobante exitosamente', async () => {
      const req = {
        params: { id: 1 },
        file: { path: '/tmp/test.jpg', originalname: 'test.jpg' }
      };
      const res = { json: jest.fn() };

      query.mockResolvedValueOnce({
        rows: [{ id: 1, status: 'pending' }]
      });
      query.mockResolvedValueOnce({ rows: [] });

      await uploadReceipt(req, res);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          ok: true,
          url: expect.stringContaining('.jpg'),
          filename: expect.stringContaining('.jpg')
        })
      );
    });

    test('retorna 400 si no hay archivo', async () => {
      const req = {
        params: { id: 1 },
        file: null
      };
      const res = {
        status: jest.fn(() => res),
        json: jest.fn()
      };

      await uploadReceipt(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'No se recibió ninguna imagen' });
    });

    test('retorna 404 si pedido no existe', async () => {
      const req = {
        params: { id: 999 },
        file: { path: '/tmp/test.jpg', originalname: 'test.jpg' }
      };
      const res = {
        status: jest.fn(() => res),
        json: jest.fn()
      };

      query.mockResolvedValueOnce({ rows: [] });

      await uploadReceipt(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ error: 'Pedido no encontrado' });
    });

    test('guarda receipt en BD', async () => {
      const req = {
        params: { id: 1 },
        file: { path: '/tmp/test.jpg', originalname: 'test.jpg' }
      };
      const res = {
        status: jest.fn(() => res),
        json: jest.fn()
      };

      query.mockResolvedValueOnce({
        rows: [{ id: 1 }]
      });
      query.mockResolvedValueOnce({ rows: [] });

      await uploadReceipt(req, res);

      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO receipts'),
        expect.arrayContaining([1, expect.stringContaining('.jpg'), expect.any(String)])
      );
    });

    test('retorna 500 en error de DB', async () => {
      const req = {
        params: { id: 1 },
        file: { path: '/tmp/test.jpg', originalname: 'test.jpg' }
      };
      const res = {
        status: jest.fn(() => res),
        json: jest.fn()
      };

      query.mockRejectedValueOnce(new Error('DB error'));

      await uploadReceipt(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: 'Error interno del servidor' });
    });
  });
});
