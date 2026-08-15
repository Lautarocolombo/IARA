const validator = require('validator');

function xssClean(input) {
  if (typeof input !== 'string') return input;
  return validator.escape(input, { escapeMode: 'html' }).replace(/&#x2F;/g, '/');
}

function sanitizeBody(options) {
  options = options || {};
  const excludeKeys = options.excludeKeys || [];
  return function(req, res, next) {
    if (req.body && typeof req.body === 'object') {
      req.body = sanitizeObject(req.body, excludeKeys);
    }
    if (req.query && typeof req.query === 'object') {
      req.query = sanitizeObject(req.query, excludeKeys);
    }
    if (req.params && typeof req.params === 'object') {
      req.params = sanitizeObject(req.params, excludeKeys);
    }
    next();
  };
}

function sanitizeObject(obj, excludeKeys) {
  excludeKeys = excludeKeys || [];
  if (Array.isArray(obj)) {
    return obj.map(function(v) { return sanitizeObject(v, excludeKeys); });
  }
  if (obj === null || typeof obj !== 'object') {
    return xssClean(obj);
  }
  const sanitized = {};
  for (const key of Object.keys(obj)) {
    const value = obj[key];
    if (excludeKeys.indexOf(key) !== -1) {
      sanitized[key] = value;
      continue;
    }
    if (Array.isArray(value)) {
      sanitized[key] = value.map(function(v) { return (typeof v === 'object' && v !== null ? sanitizeObject(v, excludeKeys) : xssClean(v)); });
    } else if (value !== null && typeof value === 'object') {
      sanitized[key] = sanitizeObject(value, excludeKeys);
    } else {
      sanitized[key] = xssClean(value);
    }
  }
  return sanitized;
}

module.exports = { xssClean, sanitizeBody };
