const express = require('express');
const router = express.Router();
const EventEmitter = require('events');
const { adminAuth } = require('../middleware/auth');

const PUBLIC_EVENTS = ['products_updated', 'hero_updated', 'testimonials_updated'];
const PRIVATE_EVENTS = ['settings_updated', 'order_created', 'order_status_updated', 'reviews_updated'];

class SyncBus extends EventEmitter {}
const syncBus = new SyncBus();

function sendEvent(res, event, data) {
  try {
    res.write(`event: ${event}\n`);
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  } catch (e) {
    // client disconnected
  }
}

router.get('/', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');

  const isAdmin = !!req.user;

  const publicListeners = {};
  const privateListeners = {};

  PUBLIC_EVENTS.forEach(event => {
    publicListeners[event] = (data) => {
      if (!isAdmin && PRIVATE_EVENTS.includes(event)) return;
      sendEvent(res, event, data);
    };
  });

  if (isAdmin) {
    PRIVATE_EVENTS.forEach(event => {
      privateListeners[event] = (data) => {
        sendEvent(res, event, data);
      };
    });
  }

  const allListeners = { ...publicListeners, ...privateListeners };
  Object.entries(allListeners).forEach(([event, handler]) => {
    syncBus.on(event, handler);
  });

  res.write(':\n\n');

  req.on('close', () => {
    Object.entries(allListeners).forEach(([event, handler]) => {
      syncBus.off(event, handler);
    });
  });
});

module.exports = router;
module.exports.syncBus = syncBus;
