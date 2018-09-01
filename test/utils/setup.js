
const isAppveyor = !!process.env.APPVEYOR
describe.skip.appveyor = isAppveyor ? describe.skip : describe
test.skip.appveyor = isAppveyor ? test.skip : test

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
