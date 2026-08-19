const crypto = require('crypto');

function generateETag(data) {
  const str = typeof data === 'string' ? data : JSON.stringify(data);
  return crypto.createHash('md5').update(str).digest('hex');
}

function applyETag(req, res, data) {
  const tag = generateETag(data);
  res.setHeader('ETag', `"${tag}"`);
  res.setHeader('Cache-Control', 'public, max-age=300');

  const clientETag = req.headers?.['if-none-match'];
  if (clientETag && clientETag === `"${tag}"`) {
    res.status(304).send();
    return true;
  }
  return false;
}

module.exports = { generateETag, applyETag };
