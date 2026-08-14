module.exports = {
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: [],
  rootDir: '../../',
  testMatch: ['<rootDir>/tests/**/*.test.js', '<rootDir>/frontend/tests/**/*.test.js'],
  moduleFileExtensions: ['js'],
  verbose: true,
  testTimeout: 10000
};
