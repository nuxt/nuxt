module.exports = {
  testEnvironment: 'node',
  collectCoverageFrom: [
    'packages/*/src/**/*.mjs',
    'packages/*/src/**/*.js'
  ],
  coverageDirectory: './coverage/',
  coveragePathIgnorePatterns: [
    '/node_modules/',
    '<rootDir>/packages/core/src/app/',
    '<rootDir>/packages/core/src/builder/webpack/plugins/vue/'
  ],
  setupTestFrameworkScriptFile: './test/utils/setup',
  testPathIgnorePatterns: [
    'node_modules',
    'test/fixtures/.*/.*?/'
  ],
  transformIgnorePatterns: ['/node_modules/'],
  moduleFileExtensions: ['js', 'mjs', 'json'],
  expand: true,
  forceExit: true
  // https://github.com/facebook/jest/pull/6747 fix warning here
  // But its performance overhead is pretty bad (30+%).
  // detectOpenHandles: true
}
