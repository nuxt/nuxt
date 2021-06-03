 fs = require('fs')
 path = require('path')

 corePackages = fs.readdirSync(path.resolve(__dirname, 'packages'))

module.exports = {
  testEnvironment: 'node',

  expand: true,

  forceExit: true,

  roots: [
    '<rootDir>/packages',
    '<rootDir>/test'
  ],

  // https://github.com/facebook/jest/pull/6747 fix warning here
  // But its performance overhead is pretty bad (30+%).
  // detectOpenHandles: true

  setupFilesAfterEnv: ['./test/utils/setup-env'],
  setupFiles: ['./test/utils/setup'],

  coverageDirectory: './coverage',

  collectCoverageFrom: [
    '**/packages/*/src/**/*.js'
  ],

  coveragePathIgnorePatterns: [
    'node_modules/(?!(@nuxt|nuxt))',
    'packages/webpack/src/config/plugins/vue',
    'packages/server/src/jsdom'
  ],

  testPathIgnorePatterns: [
    'node_modules/(?!(@nuxt|nuxt))',
    'test/fixtures/.*/.*?/',
    'examples/.*'
  ],

  transformIgnorePatterns: [
    'node_modules/(?!(@nuxt|nuxt))',
    'packages/utils/test/serialize\\.test\\.input\\.js'
  ],

  transform: {
    '^.+\\.js$': 'babel-jest',
    '^.+\\.vue$': 'vue-jest'
  },

  moduleFileExtensions: [
    'js',
    'json'
  ],

  moduleNameMapper: {
    [`@nuxt/(${corePackages.join('|')})(/?.*)$`]: '<rootDir>/packages/$1/src/$2'
  }
}
