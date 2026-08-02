module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/*.test.js'],
  moduleFileExtensions: ['js'],
  transform: {},
  verbose: true,
  testTimeout: 20000,
  setupFiles: ['<rootDir>/jest.setup.js'],
  forceExit: true
};
