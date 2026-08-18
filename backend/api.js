const { app, dbReady } = require('./src/server.js');

dbReady.catch((err) => {
  if (err) {
    const logger = require('./src/lib/logger');
    logger.error('DB init failed in serverless:', err.message);
  }
});

module.exports = app;
