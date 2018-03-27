module.exports = {
  testEnvironment: 'node',
  coverageDirectory: './coverage/',
  setupTestFrameworkScriptFile: './test/utils/setup',
  testPathIgnorePatterns: ['test/fixtures/.*/.*?/'],
  moduleFileExtensions: ['js', 'mjs', 'json'],
  expand: true
}
