const fs = require('fs')
const path = require('path')

const corePackages = fs.readdirSync(path.resolve(__dirname, 'packages'))

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
    'node_modules/(?!(@nuxt|@sindresorhus|@szmarczak|nuxt|devalue|got|p-cancelable|cacheable-request|normalize-url|responselike|lowercase-keys|mimic-response|form-data-encoder|cacheable-lookup|get-port))',
    'packages/utils/test/serialize\\.test\\.input\\.js'
  ],

  transform: {
    '^.+\\.[cm]?[jt]sx?$': 'babel-jest',
    '^.+\\.vue$': '@vue/vue2-jest'
  },

  moduleFileExtensions: [
    'js',
    'json'
  ],

  moduleNameMapper: {
    [`consola$`]: '<rootDir>/node_modules/consola/dist/index.basic.cjs',
    [`@nuxt/(${corePackages.join('|')})(/?.*)$`]: '<rootDir>/packages/$1/src/$2'
  }
}
