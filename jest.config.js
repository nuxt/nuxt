module.exports = {
  testEnvironment: 'node',
  coverageDirectory: './coverage/',
  coveragePathIgnorePatterns: [
    '<rootDir>/node_modules/',
    '<rootDir>/lib/builder/webpack/plugins/vue'
  ],
  setupTestFrameworkScriptFile: './test/utils/setup',
  testPathIgnorePatterns: ['test/fixtures/.*/.*?/'],
  moduleFileExtensions: ['js', 'mjs', 'json'],
  expand: true
}
