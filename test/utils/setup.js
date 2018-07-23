// eslint-disable
require('babel-polyfill')
require('consola').clear().add({
  log: jest.fn()
})

const isAppveyor = !!process.env.APPVEYOR

jest.setTimeout((isAppveyor ? 120 : 60) * 1000)

describe.skip.appveyor = isAppveyor ? describe.skip : describe
test.skip.appveyor = isAppveyor ? test.skip : test
