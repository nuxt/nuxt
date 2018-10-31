import Consola from 'consola'

const isWin = process.platform === 'win32'
describe.skip.win = isWin ? describe.skip : describe
test.skip.win = isWin ? test.skip : test

jest.setTimeout(60000)

Consola.setReporters([
  {
    log: jest.fn()
  }
])
