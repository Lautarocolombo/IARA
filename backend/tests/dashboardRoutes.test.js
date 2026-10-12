jest.mock('../src/lib/db', () => ({
  query: jest.fn()
}));

jest.mock('../src/lib/tokenBlacklist', () => ({
  has: jest.fn().mockResolvedValue(false)
}));

const express = require('express');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const { query } = require('../src/lib/db');
const dashboardRoutes = require('../src/routes/dashboard');

describe('dashboard stats route', () => {
  const secret = 'dashboard-route-test-secret';

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.JWT_SECRET = secret;
  });

  function createApp() {
    const app = express();
    app.use('/api/v1', dashboardRoutes);
    app.use('/api', dashboardRoutes);
    return app;
  }

  test('requires an authenticated admin', async () => {
    const response = await request(createApp()).get('/api/v1/admin/dashboard/stats');

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ error: 'No autorizado' });
    expect(query).not.toHaveBeenCalled();
  });

  test('returns dashboard stats in the frontend contract', async () => {
    query
      .mockResolvedValueOnce({ rows: [{ total: '1200', count: '2' }] })
      .mockResolvedValueOnce({ rows: [{ total: '4300', count: '5' }] })
      .mockResolvedValueOnce({ rows: [{ total: '9500', count: '9' }] })
      .mockResolvedValueOnce({ rows: [{ count: '3' }] })
      .mockResolvedValueOnce({ rows: [{ id: 1, name: 'Pulsera', stock: 2, category: 'Pulseras', price: '500' }] })
      .mockResolvedValueOnce({ rows: [{ id: 2, status: 'pending', total: '750', shipping_name: 'Cliente', customer: null, created_at: '2026-10-11T12:00:00Z' }] })
      .mockResolvedValueOnce({ rows: [{ id: 3, username: 'admin', action: 'update', entity_type: 'product', entity_id: 1, details: {}, created_at: '2026-10-11T12:00:00Z' }] });
    const token = jwt.sign({ role: 'admin', user: 'admin' }, secret);

    const response = await request(createApp())
      .get('/api/v1/admin/dashboard/stats')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      sales: {
        today: { total: 1200, count: 2 },
        week: { total: 4300, count: 5 },
        month: { total: 9500, count: 9 }
      },
      alerts: {
        pendingOrders: 3,
        lowStockProducts: 1,
        lowStockList: [{ id: 1, name: 'Pulsera', stock: 2, category: 'Pulseras', price: 500 }]
      },
      recentOrders: [{
        id: 2,
        status: 'pending',
        total: 750,
        customerName: 'Cliente',
        createdAt: '2026-10-11T12:00:00Z'
      }],
      activityLog: [{
        id: 3,
        username: 'admin',
        action: 'update',
        entityType: 'product',
        entityId: 1,
        details: {},
        createdAt: '2026-10-11T12:00:00Z'
      }]
    });
  });

  test('keeps the legacy /api alias available', async () => {
    query
      .mockResolvedValueOnce({ rows: [{ total: '0', count: '0' }] })
      .mockResolvedValueOnce({ rows: [{ total: '0', count: '0' }] })
      .mockResolvedValueOnce({ rows: [{ total: '0', count: '0' }] })
      .mockResolvedValueOnce({ rows: [{ count: '0' }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });
    const token = jwt.sign({ role: 'admin', user: 'admin' }, secret);

    const response = await request(createApp())
      .get('/api/admin/dashboard/stats')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.sales.today).toEqual({ total: 0, count: 0 });
  });
});
