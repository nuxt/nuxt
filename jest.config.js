module.exports = {
  testEnvironment: 'node',
  coverageDirectory: './coverage/',
  setupTestFrameworkScriptFile: './test/utils/setup',
  testPathIgnorePatterns: ['test/fixtures/.*/.*?/'],
  moduleFileExtensions: ['js', 'mjs', 'json'],
  transformIgnorePatterns: [
    '/node_modules/',
    'nuxt-test.js'
  ],
  transform: {
    'test/.+\\.js?$': 'babel-jest'
  }
}
