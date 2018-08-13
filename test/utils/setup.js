// eslint-disable
require('consola').clear().add({
  log: jest.fn()
})

jasmine.DEFAULT_TIMEOUT_INTERVAL = 60 * 1000

const isAppveyor = !!process.env.APPVEYOR
describe.skip.appveyor = isAppveyor ? describe.skip : describe
test.skip.appveyor = isAppveyor ? test.skip : test
