/* eslint-disable no-console */
export default function mockConsole(levels = 'all') {
  if (levels === 'all') {
    levels = ['trace', 'debug', 'log', 'info', 'warn', 'error']
  }
  beforeAll(() => {
    for (let level of levels) {
      console[level] = jest.fn()
    }
  })
  beforeEach(() => {
    for (let level of levels) {
      console[level].mockClear()
    }
  })
  afterAll(() => {
    for (let level of levels) {
      console[level].mockRestore()
    }
  })
  return console
}
