const { query } = require('../lib/db');
const logger = require('../lib/logger');
const path = require('path');
const fs = require('fs');
const PDFDocument = require('pdfkit');

const generateReceiptPDF = async (req, res) => {
  const orderId = Number(req.params.id);
  try {
    const result = await query('SELECT * FROM orders WHERE id = $1', [orderId]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Pedido no encontrado' });
    
    const order = result.rows[0];
    const customer = typeof order.customer === 'string' ? JSON.parse(order.customer) : order.customer;
    const items = typeof order.items === 'string' ? JSON.parse(order.items) : order.items;
    
    const filename = `comprobante-pedido-${orderId}.pdf`;
    const filepath = path.join(__dirname, '..', '..', 'uploads', 'receipts', filename);
    
    if (!fs.existsSync(path.dirname(filepath))) {
      fs.mkdirSync(path.dirname(filepath), { recursive: true });
    }

    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    const stream = fs.createWriteStream(filepath);
    doc.pipe(stream);

    doc.fontSize(20).font('Helvetica-Bold').text('ARTESANÍA GUALEGUAY', { align: 'center' });
    doc.moveDown();
    doc.fontSize(12).font('Helvetica').text(`Pedido #${order.id}`, { align: 'center' });
    doc.text(`Fecha: ${new Date(order.created_at).toLocaleString('es-AR')}`, { align: 'center' });
    doc.text(`Estado: ${order.status}`, { align: 'center' });
    doc.moveDown();
    
    doc.font('Helvetica-Bold').text('CLIENTE:', { underline: true });
    doc.font('Helvetica');
    doc.text(`Nombre: ${customer?.name || '—'}`);
    doc.text(`Email: ${customer?.email || '—'}`);
    doc.text(`Teléfono: ${customer?.phone || '—'}`);
    doc.text(`Dirección: ${customer?.address || '—'}`);
    doc.moveDown();
    
    doc.font('Helvetica-Bold').text('ITEMS:', { underline: true });
    doc.font('Helvetica');
    items.forEach((it, i) => {
      doc.text(`${i + 1}. ${it.name || 'Producto'} x${it.quantity || 1} — $${Number(it.price || 0).toLocaleString('es-AR')}`);
    });
    doc.moveDown();
    
    doc.font('Helvetica-Bold');
    doc.text(`SUBTOTAL: $${Number(order.subtotal || 0).toLocaleString('es-AR')}`);
    doc.text(`ENVÍO: $${Number(order.shipping_cost || 0).toLocaleString('es-AR')}`);
    doc.fontSize(14).text(`TOTAL: $${Number(order.total).toLocaleString('es-AR')}`, { underline: true });
    doc.moveDown();
    
    doc.fontSize(10).font('Helvetica').text('¡Gracias por tu compra!', { align: 'center' });
    doc.end();

    stream.on('finish', () => {
      const url = `/uploads/receipts/${filename}`;
      query('INSERT INTO receipts (order_id, filename, url) VALUES ($1, $2, $3) ON CONFLICT (order_id) DO UPDATE SET filename = $4, url = $5', [orderId, filename, url, filename, url])
        .then(() => {
          res.download(filepath, filename);
        })
        .catch(err => {
          logger.error('Error guardando receipt:', err);
          res.download(filepath, filename);
        });
    });
  } catch (err) {
    logger.error('Error generando comprobante:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

const sendReceiptWhatsApp = async (req, res) => {
  const orderId = Number(req.params.id);
  try {
    const result = await query('SELECT * FROM orders WHERE id = $1', [orderId]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Pedido no encontrado' });
    
    const order = result.rows[0];
    const customer = typeof order.customer === 'string' ? JSON.parse(order.customer) : order.customer;
    const phone = (customer?.phone || '').replace(/[^\d]/g, '');
    
    if (!phone) {
      return res.status(400).json({ error: 'El pedido no tiene teléfono de cliente' });
    }

    const text = encodeURIComponent(`Hola! Te paso el comprobante de tu pedido #${order.id} por un total de $${Number(order.total).toLocaleString('es-AR')}. Gracias por tu compra!`);
    const whatsappUrl = `https://wa.me/${phone}?text=${text}`;

    await query('UPDATE receipts SET sent_whatsapp = TRUE WHERE order_id = $1', [orderId]);

    res.json({ ok: true, whatsappUrl });
  } catch (err) {
    logger.error('Error enviando WhatsApp:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

module.exports = { generateReceiptPDF, sendReceiptWhatsApp };
