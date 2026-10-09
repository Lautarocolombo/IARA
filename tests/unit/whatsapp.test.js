'use strict';

const {
  sanitizePhone,
  buildOrderMessage,
  buildWhatsAppLinks,
  formatARS,
  truncateMessageForUrl
} = require('../../frontend/js/utils/whatsapp.js');

describe('whatsapp.js helper', () => {
  describe('sanitizePhone', () => {
    test('elimina + y espacios y normaliza prefijos', () => {
      expect(sanitizePhone('+54 9 3444 634444')).toBe('3444634444');
    });

    test('elimina guiones y paréntesis y normaliza prefijos', () => {
      expect(sanitizePhone('+54 (9) 3444-634444')).toBe('3444634444');
    });

    test('quita prefijo 549', () => {
      expect(sanitizePhone('5493444634444')).toBe('3444634444');
    });

    test('quita prefijo 54', () => {
      expect(sanitizePhone('543444634444')).toBe('3444634444');
    });

    test('quita prefijo 15', () => {
      expect(sanitizePhone('153444634444')).toBe('3444634444');
    });

    test('quita prefijo 0', () => {
      expect(sanitizePhone('03444634444')).toBe('3444634444');
    });

    test('devuelve string vacío para entrada vacía', () => {
      expect(sanitizePhone('')).toBe('');
      expect(sanitizePhone(null)).toBe('');
      expect(sanitizePhone(undefined)).toBe('');
    });

    test('mantiene solo dígitos válidos', () => {
      expect(sanitizePhone('abc123def')).toBe('123');
    });
  });

  describe('formatARS', () => {
    test('formatea números correctamente', () => {
      expect(formatARS(1000)).toContain('1.000');
      expect(formatARS(1500.50)).toContain('1.500,50');
    });

    test('maneja valores inválidos', () => {
      expect(formatARS('invalid')).toContain('NaN');
    });
  });

  describe('buildOrderMessage', () => {
    const baseOrder = {
      orderNumber: '#0006',
      customerName: 'Juan Pérez',
      items: [
        { name: 'Pulsera de cuero', qty: 2, price: 1500 },
        { name: 'Llavero de metal', qty: 1, price: 800 }
      ],
      subtotal: 3800,
      shippingCost: 200,
      shippingProvince: 'Buenos Aires',
      shippingAddress: 'Calle 123',
      shippingCity: 'La Plata',
      total: 4000,
      paymentMethod: 'transfer',
      alias: 'iara-salgueiro'
    };

    test('construye mensaje con todos los campos', () => {
      const msg = buildOrderMessage(baseOrder);
      expect(msg).toContain('Hola! Soy Juan Pérez');
      expect(msg).toContain('pedido #0006');
      expect(msg).toContain('Pulsera de cuero x2');
      expect(msg).toContain('Llavero de metal x1');
      expect(msg).toContain('Subtotal productos');
      expect(msg).toContain('Diferencia de envio (Buenos Aires)');
      expect(msg).toContain('Direccion: Calle 123, La Plata, Buenos Aires');
      expect(msg).toContain('Alias Mercado Pago: iara-salgueiro');
      expect(msg).toContain('Total:');
      expect(msg).toContain('Realicé la transferencia y enviaré el comprobante desde la app.');
    });

    test('no incluye emojis', () => {
      const msg = buildOrderMessage(baseOrder);
      const emojiRegex = /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F700}-\u{1F77F}]/u;
      expect(msg).not.toMatch(emojiRegex);
    });

    test('maneja envío gratis', () => {
      const order = { ...baseOrder, shippingCost: 0, shippingProvince: '' };
      const msg = buildOrderMessage(order);
      expect(msg).toContain('Envio incluido en el precio');
      expect(msg).not.toContain('Diferencia de envio');
    });

    test('maneja pago en efectivo', () => {
      const order = { ...baseOrder, paymentMethod: 'cash' };
      const msg = buildOrderMessage(order);
      expect(msg).toContain('Voy a pagar en efectivo al retirar/recibir.');
      expect(msg).not.toContain('Realicé la transferencia y enviaré el comprobante desde la app.');
    });

    test('sanitiza nombres de productos con emojis', () => {
      const order = {
        ...baseOrder,
        items: [{ name: 'Pulsera 😀🔥', qty: 1, price: 1000 }]
      };
      const msg = buildOrderMessage(order);
      expect(msg).not.toContain('😀');
      expect(msg).not.toContain('🔥');
    });

    test('no incluye emojis en el mensaje final', () => {
      const msg = buildOrderMessage(baseOrder);
      const emojiRegex = /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F700}-\u{1F77F}]/u;
      expect(msg).not.toMatch(emojiRegex);
    });
  });

  describe('buildWhatsAppLinks', () => {
    test('genera 3 URLs: primary, fallback, deeplink', () => {
      const links = buildWhatsAppLinks('3444634444', 'Hola mundo');
      expect(links.primary).toMatch(/^https:\/\/wa\.me\/5493444634444\?text=/);
      expect(links.fallback).toMatch(/^https:\/\/api\.whatsapp\.com\/send\?phone=5493444634444&text=/);
      expect(links.deeplink).toMatch(/^whatsapp:\/\/send\?phone=5493444634444&text=/);
    });

    test('codifica correctamente caracteres especiales', () => {
      const msg = 'Pedido #0006: Total $1000 & más';
      const links = buildWhatsAppLinks('3444634444', msg);
      expect(links.primary).toContain('%23'); // #
      expect(links.primary).toContain('%26'); // &
      expect(links.primary).toContain('%20'); // espacio
    });

    test('codifica saltos de línea', () => {
      const msg = 'Línea 1\nLínea 2';
      const links = buildWhatsAppLinks('3444634444', msg);
      expect(links.primary).toContain('%0A'); // \n
    });

    test('trunca si URL supera MAX_URL_LENGTH', () => {
      const longMsg = 'A'.repeat(2000);
      const links = buildWhatsAppLinks('3444634444', longMsg);
      expect(links.primary.length).toBeLessThanOrEqual(1800);
      expect(links.fallback.length).toBeLessThanOrEqual(1800);
    });
  });

  describe('truncateMessage', () => {
    test('trunca mensaje largo manteniendo header y footer', () => {
      const order = {
        orderNumber: '#0001',
        customerName: 'Test',
        items: Array.from({ length: 20 }, (_, i) => ({ name: `Producto ${i}`, qty: 1, price: 100 })),
        subtotal: 2000,
        shippingCost: 0,
        shippingProvince: '',
        shippingAddress: '',
        shippingCity: '',
        total: 2000,
        paymentMethod: 'transfer',
        alias: ''
      };
      const msg = buildOrderMessage(order);
      expect(msg.length).toBeLessThanOrEqual(1600);
      expect(msg).toContain('Hola! Soy Test');
      expect(msg).toContain('Total:');
    });
  });

  describe('truncateMessageForUrl', () => {
    test('trunca mensaje para que quepa en URL', () => {
      const msg = 'A'.repeat(2000);
      const truncated = truncateMessageForUrl(msg, 1000);
      expect(truncated.length).toBeLessThanOrEqual(1000);
    });

    test('no trunca si ya cabe', () => {
      const msg = 'Mensaje corto';
      const truncated = truncateMessageForUrl(msg, 1000);
      expect(truncated).toBe(msg);
    });
  });
});