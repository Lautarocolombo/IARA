/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: 'node',
  transform: {},
  maxWorkers: 1,
  testTimeout: 60000,
  setupFiles: ['<rootDir>/tests/jest.setup.js'],
  globalTeardown: '<rootDir>/tests/globalTeardown.js',
  coverageDirectory: 'coverage',
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/server.js',
    '!src/lib/db.js',
    '!src/lib/db_test.js',
    '!src/middleware/**/*.js',
    '!src/lib/imageVariants.js',
    '!src/lib/redisStore.js',
    '!src/lib/migrator.js',
    '!src/lib/parser.js',
    '!src/lib/tokenBlacklist.js',
    '!src/queues/**/*.js',
    '!src/scripts/**/*.js',
    '!src/routes/sitemap.js',
    '!src/routes/sync.js',
    '!src/routes/auth.js',
    '!src/routes/newsletter.js',
    '!src/routes/contact.js',
    '!src/routes/receipts.js',
    '!src/lib/webhookQueue.js',
    '!src/lib/upload.js',
    '!src/lib/validators.js',
    '!src/lib/imageOptimizer.js',
    '!src/lib/auth.js',
    '!src/routes/health.js',
    '!src/controllers/ordersController.js',
    '!src/controllers/productsController.js',
    '!src/controllers/reportsController.js',
    '!src/controllers/earningsController.js'
  ],
  coverageThreshold: {
    global: {
      branches: 73,
      functions: 71,
      lines: 87,
      statements: 85
    }
  }
};
