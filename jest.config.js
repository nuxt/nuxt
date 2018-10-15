module.exports = {
  testEnvironment: 'node',

  expand: true,

  forceExit: true,

  // https://github.com/facebook/jest/pull/6747 fix warning here
  // But its performance overhead is pretty bad (30+%).
  // detectOpenHandles: true

  setupTestFrameworkScriptFile: './test/utils/setup',

  coverageDirectory: './coverage',

  collectCoverageFrom: [
    'packages/*/src/**/*.mjs',
    'packages/*/src/**/*.js'
  ],

  coveragePathIgnorePatterns: [
    '/node_modules',
    '<rootDir>/packages/app',
    '<rootDir>/packages/builder/webpack/plugins/vue'
  ],

  testPathIgnorePatterns: [
    'node_modules',
    'test/fixtures/.*/.*?/',
    'examples/.*'
  ],

  transformIgnorePatterns: [
    '/node_modules/',
    '/dist/'
  ],

  moduleFileExtensions: [
    'js',
    'mjs',
    'json'
  ]
}
