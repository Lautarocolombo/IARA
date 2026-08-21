async function teardown() {
  try {
    const { closeDB } = require('./src/lib/db');
    if (typeof closeDB === 'function') {
      await closeDB();
    }
  } catch (e) {
    // noop
  }
}

module.exports = teardown;
