function cspMiddleware(req, res, next) {
  const nonce = req.nonce || '';
  const csp = [
    "default-src 'self'",
    `script-src 'self' https://cdn.jsdelivr.net https://cdn.vercel-insights.com https://www.googletagmanager.com 'nonce-${nonce}'`,
    "style-src 'self' https://fonts.googleapis.com https://cdn.jsdelivr.net 'unsafe-inline'",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data: https: blob:",
    "connect-src 'self' https://api.resend.com https://vitals.vercel-insights.com https://*.googleanalytics.com https://*.google-analytics.com https://stats.g.doubleclick.net",
    "frame-src 'self' https://maps.google.com https://www.google.com",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "upgrade-insecure-requests"
  ].join('; ');

  res.setHeader('Content-Security-Policy', csp);
  next();
}

module.exports = { cspMiddleware };
