const express = require('express');
const router = express.Router();
const EventEmitter = require('events');

class SyncBus extends EventEmitter {}
const syncBus = new SyncBus();

router.get('/', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');

  const send = (event, data) => {
    try {
      res.write(`event: ${event}\n`);
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    } catch (e) {
      // client disconnected
    }
  };

  const listeners = {
    products_updated: (data) => send('products_updated', data),
    hero_updated: (data) => send('hero_updated', data),
    site_texts_updated: (data) => send('site_texts_updated', data),
    settings_updated: (data) => send('settings_updated', data),
    order_created: (data) => send('order_created', data),
    order_status_updated: (data) => send('order_status_updated', data),
    testimonials_updated: (data) => send('testimonials_updated', data),
    reviews_updated: (e) => send('reviews_updated', e.data),
    carousel_updated: (data) => send('carousel_updated', data),
    sales_updated: (data) => send('sales_updated', data),
  };

  Object.entries(listeners).forEach(([event, handler]) => {
    syncBus.on(event, handler);
  });

  res.write(':\n\n');

  req.on('close', () => {
    Object.entries(listeners).forEach(([event, handler]) => {
      syncBus.off(event, handler);
    });
  });
});

module.exports = router;
module.exports.syncBus = syncBus;
