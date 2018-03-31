// eslint-disable
require('babel-polyfill')

const consola = require('consola')

jasmine.DEFAULT_TIMEOUT_INTERVAL = 60 * 1000

consola.clear().add({
  log: jest.fn()
})
