module.exports = {
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/tests/unit/jest.setup.js'],
  rootDir: '../../',
  testMatch: ['<rootDir>/tests/**/*.test.js', '<rootDir>/frontend/tests/**/*.test.js'],
  moduleFileExtensions: ['js'],
  verbose: true,
  testTimeout: 10000,
  coverageDirectory: 'coverage',
  collectCoverageFrom: [
    'frontend/js/**/*.js',
    '!frontend/js/vendor/**',
    '!frontend/js/analytics.js',
    '!frontend/js/cookie-consent.js',
  ],
  coverageThreshold: {
    global: {
      branches: 16,
      functions: 19,
      lines: 21,
      statements: 20
    }
  }
};