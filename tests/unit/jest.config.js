module.exports = {
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: [],
  rootDir: '../../',
  testRegex: '(/tests/unit/.*|/frontend/tests/.*)\\.test\\.js$',
  testPathIgnorePatterns: ['/node_modules/', '/backend/', '/dist/', '/.vercel/'],
  moduleFileExtensions: ['js'],
  verbose: true,
  testTimeout: 10000,
  coverageDirectory: 'coverage',
  collectCoverageFrom: [
    'frontend/js/**/*.js',
    '!frontend/js/vendor/**',
    '!frontend/js/admin-*.js',
    '!frontend/js/pages/**/*.js',
    '!frontend/js/analytics.js',
    '!frontend/js/cookie-consent.js',
    '!frontend/js/home-init.js',
    '!frontend/js/tracking.js',
    '!frontend/js/ui.js'
  ],
  coverageThreshold: {
    global: {
      branches: 45,
      functions: 45,
      lines: 50,
      statements: 50
    }
  }
};
