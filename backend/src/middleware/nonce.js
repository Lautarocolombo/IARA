const crypto = require('crypto');

function nonceMiddleware(req, res, next) {
  const nonce = req.nonce || crypto.randomBytes(16).toString('base64');
  req.nonce = nonce;
  res.locals.nonce = nonce;

  const originalSend = res.send;
  res.send = function (body) {
    if (typeof body === 'string' && body.includes('</head>') && req.nonce) {
      const nonceAttr = ` nonce="${req.nonce}"`;
      body = body.replace(/<script\b/gi, `<script${nonceAttr}`);
      body = body.replace(/<style\b/gi, `<style${nonceAttr}`);
    }
    return originalSend.call(this, body);
  };

  const originalWrite = res.write;
  res.write = function (chunk, encoding, callback) {
    if (typeof chunk === 'string' && req.nonce && res.getHeader('Content-Type')?.includes('text/html')) {
      chunk = chunk.replace(/<script\b/gi, `<script nonce="${req.nonce}"`);
      chunk = chunk.replace(/<style\b/gi, `<style nonce="${req.nonce}"`);
    }
    return originalWrite.call(this, chunk, encoding, callback);
  };

  next();
}

module.exports = { nonceMiddleware };
