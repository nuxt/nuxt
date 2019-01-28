module.exports = {
  testEnvironment: 'node',

  expand: true,

  forceExit: true,

  // https://github.com/facebook/jest/pull/6747 fix warning here
  // But its performance overhead is pretty bad (30+%).
  // detectOpenHandles: true

  // setupFilesAfterEnv: ['./test/utils/setup'],
  setupTestFrameworkScriptFile: './test/utils/setup',

  coverageDirectory: './coverage',

  collectCoverageFrom: [
    '**/packages/*/src/**/*.js'
  ],

  coveragePathIgnorePatterns: [
    'node_modules/(?!(@nuxt|nuxt))',
    'packages/webpack/src/config/plugins/vue'
  ],

  testPathIgnorePatterns: [
    'node_modules/(?!(@nuxt|nuxt))',
    'test/fixtures/.*/.*?/',
    'examples/.*'
  ],

  transformIgnorePatterns: [
    'node_modules/(?!(@nuxt|nuxt))'
  ],

  transform: {
    '^.+\\.ts$': 'ts-jest',
    '^.+\\.js$': 'babel-jest',
    '.*\\.(vue)$': 'vue-jest'
  },

  moduleFileExtensions: [
    'ts',
    'js',
    'json'
  ],

  reporters: [
    'default'
  ].concat(process.env.JEST_JUNIT_OUTPUT ? ['jest-junit'] : [])
}
