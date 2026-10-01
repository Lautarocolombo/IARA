function apiVersioningMiddleware(req, res, next) {
  const originalUrl = req.originalUrl || req.url || '';
  if (originalUrl.startsWith('/api/') && !originalUrl.startsWith('/api/v1/')) {
    res.setHeader('X-API-Deprecated', 'true');
    res.setHeader('X-API-Deprecation-Info', 'Use /api/v1/ instead. This endpoint will be removed in a future version.');
  }
  next();
}

module.exports = { apiVersioningMiddleware };