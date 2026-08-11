const express = require('express');
const router = express.Router();
const { query, pool, connectionString } = require('../lib/db');
const logger = require('../lib/logger');

router.get(['/', '/health'], async (req, res) => {
  const start = Date.now();
  try {
    let dbStatus = 'disconnected';
    let dbError = null;

    if (connectionString && pool) {
      try {
        await query('SELECT 1');
        dbStatus = 'connected';
      } catch (err) {
        dbStatus = 'error';
        dbError = err.message;
        logger.warn('Healthcheck DB error:', err.message);
      }
    } else if (!connectionString) {
      dbStatus = 'sqlite-fallback';
    }

    const uptime = process.uptime();
    const memory = process.memoryUsage();
    const response = {
      status: dbStatus === 'connected' || dbStatus === 'sqlite-fallback' ? 'ok' : 'degraded',
      uptime: Math.floor(uptime),
      database: dbStatus,
      dbError: dbError || null,
      memory: {
        rss: Math.round(memory.rss / 1024 / 1024) + 'MB',
        heapUsed: Math.round(memory.heapUsed / 1024 / 1024) + 'MB'
      },
      responseTime: Date.now() - start + 'ms',
      timestamp: new Date().toISOString()
    };

    const statusCode = response.status === 'ok' ? 200 : 503;
    res.status(statusCode).json(response);
  } catch (err) {
    logger.error('Healthcheck fatal error:', err);
    res.status(503).json({
      status: 'error',
      error: err.message,
      timestamp: new Date().toISOString()
    });
  }
});

module.exports = router;
