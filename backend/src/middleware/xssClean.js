const validator = require('validator');

function xssClean(input) {
  if (typeof input !== 'string') return input;
  return validator.escape(input);
}

function sanitizeBody(req, res, next) {
  if (req.body && typeof req.body === 'object') {
    req.body = sanitizeObject(req.body);
  }
  if (req.query && typeof req.query === 'object') {
    req.query = sanitizeObject(req.query);
  }
  if (req.params && typeof req.params === 'object') {
    req.params = sanitizeObject(req.params);
  }
  next();
}

function sanitizeObject(obj) {
  if (Array.isArray(obj)) {
    return obj.map(sanitizeObject);
  }
  if (obj === null || typeof obj !== 'object') {
    return xssClean(obj);
  }
  const sanitized = {};
  for (const key of Object.keys(obj)) {
    const value = obj[key];
    if (Array.isArray(value)) {
      sanitized[key] = value.map(v => (typeof v === 'object' && v !== null ? sanitizeObject(v) : xssClean(v)));
    } else if (value !== null && typeof value === 'object') {
      sanitized[key] = sanitizeObject(value);
    } else {
      sanitized[key] = xssClean(value);
    }
  }
  return sanitized;
}

module.exports = { xssClean, sanitizeBody };
