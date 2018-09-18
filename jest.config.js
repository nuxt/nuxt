module.exports = {
  testEnvironment: 'node',
  coverageDirectory: './coverage/',
  collectCoverageFrom: [
    'lib/!(app)/**',
    '!lib/builder/webpack/plugins/vue/**'
  ],
  setupTestFrameworkScriptFile: './test/utils/setup',
  testPathIgnorePatterns: ['test/fixtures/.*/.*?/'],
  transformIgnorePatterns: ['<rootDir>/node_modules/'],
  transform: {
    "^.+\\.js$": "babel-jest",
    ".*\\.(vue)$": "vue-jest"
  },
  moduleFileExtensions: ['js', 'mjs', 'json'],
  expand: true,
  forceExit: true
  // https://github.com/facebook/jest/pull/6747 fix warning here
  // But its performance overhead is pretty bad (30+%).
  // detectOpenHandles: true
}
