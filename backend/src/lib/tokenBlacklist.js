const tokenBlacklist = new Set();
let cleanupInterval = null;

function add(token) {
  if (!token || typeof token !== 'string') return;
  tokenBlacklist.add(token);
  scheduleCleanup();
}

function has(token) {
  if (!token || typeof token !== 'string') return false;
  return tokenBlacklist.has(token);
}

function scheduleCleanup() {
  if (cleanupInterval) return;
  cleanupInterval = setInterval(() => {
    tokenBlacklist.clear();
    cleanupInterval = null;
  }, 60 * 60 * 1000);
}

process.on('exit', () => {
  if (cleanupInterval) clearInterval(cleanupInterval);
  tokenBlacklist.clear();
});

module.exports = {
  add,
  has
};
