const emailService = require('../src/services/emailService');

jest.mock('../src/lib/logger', () => ({
  error: jest.fn(),
  warn: jest.fn(),
  info: jest.fn(),
  debug: jest.fn()
}));

describe('emailService', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    process.env.RESEND_API_KEY = 'test_key';
    process.env.EMAIL_FROM = 'test@test.com';
    process.env.BUSINESS_NAME = 'Test Store';
    process.env.BUSINESS_EMAIL = 'test@test.com';
    process.env.SITE_URL = 'http://localhost:3000';
  });

  afterEach(() => {
    delete process.env.RESEND_API_KEY;
  });

  describe('sendEmail', () => {
    test('envía email exitosamente', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ id: 'email-123' })
      });

      const result = await emailService.sendEmail({
        to: 'user@test.com',
        subject: 'Test',
        html: '<p>Hello</p>'
      });

      expect(result).toBe(true);
      expect(fetch).toHaveBeenCalledWith('https://api.resend.com/emails', expect.objectContaining({ method: 'POST' }));
    });

    test('retorna false sin API key', async () => {
      delete process.env.RESEND_API_KEY;
      const result = await emailService.sendEmail({ to: 'user@test.com', subject: 'Test', html: '<p>Hi</p>' });
      expect(result).toBe(false);
    });

    test('retorna false sin parámetros requeridos', async () => {
      const result = await emailService.sendEmail({});
      expect(result).toBe(false);
    });

    test('retorna false si fetch falla', async () => {
      global.fetch = jest.fn().mockResolvedValue({ ok: false, json: async () => ({ error: 'bad' }) });
      const result = await emailService.sendEmail({ to: 'user@test.com', subject: 'Test', html: '<p>Hi</p>' });
      expect(result).toBe(false);
    });
  });

  describe('buildTemplate - order_confirmation', () => {
    test('genera template con datos de orden', () => {
      const html = emailService.buildTemplate('order_confirmation', {
        order: { id: 123, total: 5000, payment_method: 'transfer' }
      });
      expect(html).toContain('Gracias por tu pedido');
      expect(html).toContain('123');
      expect(html).toContain('5000.00');
    });
  });

  describe('buildTemplate - order_status_update', () => {
    test('genera template con estado', () => {
      const html = emailService.buildTemplate('order_status_update', {
        order: { id: 456, total: 3000 },
        status: 'confirmed'
      });
      expect(html).toContain('456');
      expect(html).toContain('confirmed');
    });
  });

  describe('buildTemplate - password_reset', () => {
    test('genera template con enlace de reset', () => {
      const html = emailService.buildTemplate('password_reset', {
        username: 'admin',
        resetLink: 'http://localhost:3000/reset-password.html?token=abc'
      });
      expect(html).toContain('Recuperación de contraseña');
      expect(html).toContain('admin');
      expect(html).toContain('reset-password.html');
    });
  });

  describe('buildTemplate - newsletter', () => {
    test('genera template de newsletter', () => {
      const html = emailService.buildTemplate('newsletter', {
        title: 'Novedades',
        content: 'Contenido especial'
      });
      expect(html).toContain('Novedades');
      expect(html).toContain('Contenido especial');
    });
  });

  describe('sendOrderConfirmationEmail', () => {
    test('envía confirmación de pedido', async () => {
      global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ id: 'e1' }) });
      const result = await emailService.sendOrderConfirmationEmail({ id: 1, total: 1000 }, 'cliente@test.com');
      expect(result).toBe(true);
    });
  });

  describe('sendOrderStatusEmail', () => {
    test('envía actualización de estado', async () => {
      global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ id: 'e1' }) });
      const result = await emailService.sendOrderStatusEmail({ id: 1, total: 1000 }, 'cliente@test.com', 'confirmed');
      expect(result).toBe(true);
    });
  });

  describe('sendNewsletterEmail', () => {
    test('envía newsletter', async () => {
      global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ id: 'e1' }) });
      const result = await emailService.sendNewsletterEmail('cliente@test.com', 'Novedades', 'Contenido');
      expect(result).toBe(true);
    });
  });
});
