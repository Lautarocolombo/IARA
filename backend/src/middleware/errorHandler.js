const logger = require('../lib/logger');

function errorHandler(err, req, res, _next) {
  const reqId = res.getHeader('X-Request-ID') || 'unknown';
  let statusCode = err.statusCode || 500;
  let errorCode = err.code || 'INTERNAL_ERROR';
  let message = err.message || 'Error interno del servidor';

  if (err.name === 'ValidationError' || err.name === 'ZodError') {
    statusCode = 400;
    errorCode = 'VALIDATION_ERROR';
    message = err.errors ? err.errors.map(e => `${e.path}: ${e.message}`).join('; ') : err.message;
  } else if (err.name === 'UnauthorizedError' || err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
    statusCode = 401;
    errorCode = 'UNAUTHORIZED';
    message = 'No autorizado';
  } else if (err.code === '23505' || err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
    statusCode = 409;
    errorCode = 'CONFLICT';
    message = 'Recurso duplicado';
  } else if (err.code === '23503' || err.code === 'SQLITE_CONSTRAINT_FOREIGNKEY') {
    statusCode = 400;
    errorCode = 'FOREIGN_KEY_ERROR';
    message = 'Referencia inválida';
  } else if (err.code === 'ECONNREFUSED' || err.code === 'ENOTFOUND') {
    statusCode = 503;
    errorCode = 'SERVICE_UNAVAILABLE';
    message = 'Servicio no disponible';
  } else if (err.name === 'MulterError') {
    statusCode = 400;
    errorCode = 'UPLOAD_ERROR';
    message = err.message;
  }

  logger.error({ reqId, err: err.message, stack: err.stack, statusCode, errorCode }, 'Server error');

  const response = {
    error: message,
    code: errorCode,
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
  err.code = 'NOT_FOUND';
  next(err);
}

module.exports = { errorHandler, notFound };