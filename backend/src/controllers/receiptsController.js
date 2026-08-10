const { query } = require('../lib/db');
const logger = require('../lib/logger');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const PDFDocument = require('pdfkit');

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
const MAX_FILE_SIZE = 5 * 1024 * 1024;

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

const uploadReceipt = async (req, res) => {
  const orderId = Number(req.params.id);
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No se recibió ninguna imagen' });
    }

    if (!ALLOWED_MIME_TYPES.includes(req.file.mimetype)) {
      return res.status(400).json({ error: 'Tipo de archivo no permitido. Usá JPG, PNG, WEBP o PDF.' });
    }

    if (req.file.size > MAX_FILE_SIZE) {
      return res.status(400).json({ error: 'El archivo es muy grande (máximo 5MB).' });
    }

    const fileBuffer = fs.readFileSync(req.file.path);
    const fileHash = crypto.createHash('sha256').update(fileBuffer).digest('hex');

    const existingHash = await query('SELECT id FROM payment_receipts WHERE file_hash = $1 AND order_id != $2', [fileHash, orderId]);
    if (existingHash.rows.length > 0) {
      return res.status(400).json({ error: 'Este comprobante ya fue utilizado en otro pedido.' });
    }

    const result = await query('SELECT * FROM orders WHERE id = $1', [orderId]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Pedido no encontrado' });
    }
    const order = result.rows[0];
    if (order.status === 'cancelled' || order.status === 'rejected' || order.status === 'expired') {
      return res.status(400).json({ error: 'No se puede enviar comprobante de un pedido cancelado, rechazado o expirado' });
    }

    const filename = `comprobante-pedido-${orderId}-${Date.now()}${path.extname(req.file.originalname)}`;
    const filepath = path.join(__dirname, '..', '..', 'uploads', 'receipts', filename);
    if (!fs.existsSync(path.dirname(filepath))) {
      fs.mkdirSync(path.dirname(filepath), { recursive: true });
    }
    fs.copyFileSync(req.file.path, filepath);
    fs.unlinkSync(req.file.path);
    const url = `/uploads/receipts/${filename}`;

    const amountPaidRaw = req.body.amount_paid;
    const amountPaid = amountPaidRaw !== undefined && amountPaidRaw !== '' ? Number(amountPaidRaw) : 0;
    if (isNaN(amountPaid) || amountPaid < 0) {
      return res.status(400).json({ error: 'El monto transferido debe ser un número mayor o igual a 0' });
    }

    await query(
      'INSERT INTO payment_receipts (order_id, filename, url, file_hash, mime_type, file_size, amount_paid, status) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
      [orderId, filename, url, fileHash, req.file.mimetype, req.file.size, amountPaid, 'pending']
    );

    if (order.payment_method === 'transfer' && order.status === 'pending') {
      await query("UPDATE orders SET status = 'awaiting_verification', payment_status = 'awaiting_verification' WHERE id = $1", [orderId]);
    }

    res.json({ ok: true, url, filename });
  } catch (err) {
    logger.error('Error subiendo comprobante:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

module.exports = { generateReceiptPDF, sendReceiptWhatsApp, uploadReceipt };
