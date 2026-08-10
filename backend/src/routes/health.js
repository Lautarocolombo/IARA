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

    const isProd = process.env.NODE_ENV === 'production';
    const response = {
      status: dbStatus === 'connected' || dbStatus === 'sqlite-fallback' ? 'ok' : 'degraded',
      uptime: Math.floor(process.uptime()),
      database: dbStatus,
      timestamp: new Date().toISOString()
    };

    if (!isProd) {
      response.memory = {
        rss: Math.round(process.memoryUsage().rss / 1024 / 1024) + 'MB',
        heapUsed: Math.round(process.memoryUsage().heapUsed / 1024 / 1024) + 'MB'
      };
      response.responseTime = Date.now() - start + 'ms';
      response.nodeVersion = process.version;
      response.platform = process.platform;
      if (dbError) response.dbError = dbError;
    }

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
