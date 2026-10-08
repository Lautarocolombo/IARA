const deprecatedApiCounter = new Map();

function apiVersioningMiddleware(req, res, next) {
  const originalUrl = req.originalUrl || req.url || '';
  const isLegacy = originalUrl.startsWith('/api/') && !originalUrl.startsWith('/api/v1/');

  if (isLegacy) {
    // Standard deprecation headers (RFC 8594)
    res.setHeader('Deprecation', 'true');
    res.setHeader('Sunset', 'Sat, 01 Nov 2025 00:00:00 GMT');
    res.setHeader('Link', '</api/v1/>; rel="successor-version"');

    // Legacy custom headers (for backward compatibility)
    res.setHeader('X-API-Deprecated', 'true');
    res.setHeader('X-API-Deprecation-Info', 'Use /api/v1/ instead. This endpoint will be removed on 2025-11-01.');

    // Track deprecated API usage
    const path = originalUrl.split('?')[0];
    const count = (deprecatedApiCounter.get(path) || 0) + 1;
    deprecatedApiCounter.set(path, count);

    // Log every 100th request to avoid noise
    if (count % 100 === 1) {
      console.warn(`[API Deprecation] ${req.method} ${path} called ${count} times. Migrate to /api/v1/`);
    }
  }

  // Expose metrics endpoint for deprecated API usage
  if (originalUrl === '/api/v1/deprecated-metrics' || originalUrl === '/api/deprecated-metrics') {
    const metrics = Object.fromEntries(deprecatedApiCounter);
    return res.json({ deprecatedEndpoints: metrics, totalCalls: Array.from(deprecatedApiCounter.values()).reduce((a, b) => a + b, 0) });
  }

  next();
}

module.exports = { apiVersioningMiddleware, deprecatedApiCounter };