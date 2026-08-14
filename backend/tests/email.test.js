jest.mock('../src/lib/logger', () => ({
  error: jest.fn(),
  warn: jest.fn(),
  info: jest.fn()
}));

const logger = require('../src/lib/logger');
const { sendEmail, sendOrderConfirmationEmail, sendOrderStatusEmail } = require('../src/lib/email');

describe('email', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest.fn();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('sendEmail', () => {
    test('retorna false si RESEND_API_KEY no está configurado', async () => {
      delete process.env.RESEND_API_KEY;

      const result = await sendEmail({ to: 'test@example.com', subject: 'Test', html: '<p>Hello</p>' });

      expect(result).toBe(false);
      expect(logger.warn).toHaveBeenCalledWith('RESEND_API_KEY no configurado, se omite envío de email');
      expect(global.fetch).not.toHaveBeenCalled();
    });

    test('retorna false si RESEND_API_KEY está vacío', async () => {
      process.env.RESEND_API_KEY = '';

      const result = await sendEmail({ to: 'test@example.com', subject: 'Test', html: '<p>Hello</p>' });

      expect(result).toBe(false);
      expect(logger.warn).toHaveBeenCalledWith('RESEND_API_KEY no configurado, se omite envío de email');
    });

    test('envía email correctamente con API key configurada', async () => {
      process.env.RESEND_API_KEY = 're_test_key';
      process.env.EMAIL_FROM = 'noreply@test.com';

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 'email-id-123' })
      });

      const result = await sendEmail({ to: 'test@example.com', subject: 'Test Subject', html: '<p>Hello</p>', text: 'Hello' });

      expect(result).toBe(true);
      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.resend.com/emails',
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Authorization': 'Bearer re_test_key',
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            from: 'noreply@test.com',
            to: 'test@example.com',
            subject: 'Test Subject',
            html: '<p>Hello</p>',
            text: 'Hello'
          })
        })
      );
      expect(logger.info).toHaveBeenCalledWith({ emailId: 'email-id-123', to: 'test@example.com' }, 'Email enviado correctamente');
    });

    test('usa EMAIL_FROM por defecto si no está configurado', async () => {
      process.env.RESEND_API_KEY = 're_test_key';
      delete process.env.EMAIL_FROM;

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 'email-id-456' })
      });

      await sendEmail({ to: 'test@example.com', subject: 'Test', html: '<p>Hi</p>' });

      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.resend.com/emails',
        expect.objectContaining({
          body: expect.stringContaining('"from":"noreply@artesaniagualeguay.com"')
        })
      );
    });

    test('retorna false si la respuesta de la API no es ok', async () => {
      process.env.RESEND_API_KEY = 're_test_key';

      global.fetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({ error: 'Unauthorized' })
      });

      const result = await sendEmail({ to: 'test@example.com', subject: 'Test', html: '<p>Hello</p>' });

      expect(result).toBe(false);
      expect(logger.error).toHaveBeenCalledWith({ error: { error: 'Unauthorized' }, status: 401 }, 'Error enviando email');
    });

    test('maneja errores de red y retorna false', async () => {
      process.env.RESEND_API_KEY = 're_test_key';

      global.fetch.mockRejectedValueOnce(new Error('Network error'));

      const result = await sendEmail({ to: 'test@example.com', subject: 'Test', html: '<p>Hello</p>' });

      expect(result).toBe(false);
      expect(logger.error).toHaveBeenCalledWith({ err: 'Network error' }, 'Error enviando email');
    });
  });

  describe('sendOrderConfirmationEmail', () => {
    test('envía email de confirmación con datos del pedido', async () => {
      process.env.RESEND_API_KEY = 're_test_key';
      process.env.EMAIL_FROM = 'noreply@test.com';

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 'confirm-email-123' })
      });

      const order = { id: 42, total: 1500.0 };
      const result = await sendOrderConfirmationEmail(order, 'customer@example.com');

      expect(result).toBe(true);
      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.resend.com/emails',
        expect.objectContaining({
          body: expect.stringContaining('Pedido confirmado #0042')
        })
      );
      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.resend.com/emails',
        expect.objectContaining({
          body: expect.stringContaining('$1500.00')
        })
      );
    });

    test('formatea correctamente el número de pedido con padStart', async () => {
      process.env.RESEND_API_KEY = 're_test_key';
      process.env.EMAIL_FROM = 'noreply@test.com';

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 'test' })
      });

      const order = { id: 5, total: 100.5 };
      await sendOrderConfirmationEmail(order, 'test@test.com');

      const call = global.fetch.mock.calls[0];
      const body = JSON.parse(call[1].body);
      expect(body.subject).toBe('Pedido confirmado #0005 - Artesanía Gualeguay');
      expect(body.html).toContain('#0005');
      expect(body.html).toContain('$100.50');
    });

    test('omite envío si RESEND_API_KEY no está configurado', async () => {
      delete process.env.RESEND_API_KEY;

      const order = { id: 1, total: 100 };
      const result = await sendOrderConfirmationEmail(order, 'customer@example.com');

      expect(result).toBe(false);
    });
  });

  describe('sendOrderStatusEmail', () => {
    test('envía email de actualización de estado con datos del pedido', async () => {
      process.env.RESEND_API_KEY = 're_test_key';
      process.env.EMAIL_FROM = 'noreply@test.com';

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 'status-email-123' })
      });

      const order = { id: 99, total: 750.0 };
      const result = await sendOrderStatusEmail(order, 'customer@example.com', 'confirmed');

      expect(result).toBe(true);
      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.resend.com/emails',
        expect.objectContaining({
          body: expect.stringContaining('Pedido #0099')
        })
      );
      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.resend.com/emails',
        expect.objectContaining({
          body: expect.stringContaining('$750.00')
        })
      );
    });

    test('incluye el estado en el asunto del email', async () => {
      process.env.RESEND_API_KEY = 're_test_key';
      process.env.EMAIL_FROM = 'noreply@test.com';

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 'test' })
      });

      const order = { id: 7, total: 200.0 };
      await sendOrderStatusEmail(order, 'test@test.com', 'shipped');

      const call = global.fetch.mock.calls[0];
      const body = JSON.parse(call[1].body);
      expect(body.subject).toBe('Pedido #0007 - shipped');
    });

    test('maneja total como string numérico', async () => {
      process.env.RESEND_API_KEY = 're_test_key';
      process.env.EMAIL_FROM = 'noreply@test.com';

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 'test' })
      });

      const order = { id: 3, total: '50.00' };
      const result = await sendOrderStatusEmail(order, 'test@test.com', 'pending');

      expect(result).toBe(true);
      const call = global.fetch.mock.calls[0];
      const body = JSON.parse(call[1].body);
      expect(body.html).toContain('$50.00');
    });
  });
});
