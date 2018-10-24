const isWin = process.platform === 'win32'
describe.skip.win = isWin ? describe.skip : describe
test.skip.win = isWin ? test.skip : test

jest.setTimeout(60000)
jest.mock('consola', () => {
  const consola = {}
  for (const level of [
    'fatal', 'error', 'warn', 'log', 'info',
    'start', 'success', 'ready', 'debug', 'trace'
  ]) {
    consola[level] = jest.fn()
  }
  return consola
})
