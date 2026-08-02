const logger = require('../lib/logger');

function errorHandler(err, req, res, _next) {
  const reqId = res.getHeader('X-Request-ID') || 'unknown';
  const statusCode = err.statusCode || 500;

  if (process.env.NODE_ENV === 'production' && statusCode === 500) {
    logger.error({ reqId, err: err.message, stack: err.stack }, 'Server error');
  } else {
    logger.error({ reqId, err: err.message, stack: err.stack }, 'Server error');
  }

  const response = {
    error: statusCode === 500 && process.env.NODE_ENV === 'production'
      ? 'Error interno del servidor'
      : err.message || 'Error interno del servidor',
    reqId
  };

  if (process.env.NODE_ENV !== 'production' && err.stack) {
    response.stack = err.stack;
  }

  res.status(statusCode).json(response);
}

function notFound(req, res, next) {
  const err = new Error(`Ruta no encontrada: ${req.originalUrl}`);
  err.statusCode = 404;
  next(err);
}

module.exports = { errorHandler, notFound };
