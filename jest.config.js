module.exports = {
  testEnvironment: 'node',
  coverageDirectory: './coverage/',
  collectCoverageFrom: [
    'packages/*/src/**/*.js'
  ],
  coveragePathIgnorePatterns: [
    '<rootDir>/packages/nuxt-core/src/app/**',
    '<rootDir>/packages/nuxt-core/src/builder/webpack/plugins/vue/**'
  ],
  setupTestFrameworkScriptFile: './test/setup',
  testPathIgnorePatterns: ['test/fixtures/.*/.*?/'],
  transformIgnorePatterns: ['/node_modules/'],
  moduleFileExtensions: ['js', 'mjs', 'json'],
  expand: true,
  forceExit: true
  // https://github.com/facebook/jest/pull/6747 fix warning here
  // But its performance overhead is pretty bad (30+%).
  // detectOpenHandles: true
}
