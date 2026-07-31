module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/*.test.js'],
  moduleFileExtensions: ['js'],
  transform: {},
  verbose: true,
  testTimeout: 15000,
  setupFiles: ['<rootDir>/jest.setup.js']
};
