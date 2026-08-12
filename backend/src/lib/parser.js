function safeJsonParse(value, fallback) {
  if (typeof value !== 'string') return value || fallback;
  try {
    const parsed = JSON.parse(value);
    return parsed || fallback;
  } catch (e) {
    return fallback;
  }
}

function safeJsonStringify(value) {
  try {
    return JSON.stringify(value);
  } catch (e) {
    return '{}';
  }
}

module.exports = {
  safeJsonParse,
  safeJsonStringify
};
