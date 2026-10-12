jest.mock('../src/controllers/settingsController', () => ({
  getPublicSettings: (req, res) => res.json({ phone: '03444-000000' })
}));

const express = require('express');
const request = require('supertest');
const settingsRoutes = require('../src/routes/settings');

describe('public settings routes', () => {
  const app = express();
  app.use('/api/v1', settingsRoutes);

  test('serves public settings at the documented settings path', async () => {
    const response = await request(app).get('/api/v1/settings/public');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ phone: '03444-000000' });
  });

  test('keeps the legacy public settings route available', async () => {
    const response = await request(app).get('/api/v1/public');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ phone: '03444-000000' });
  });
});
