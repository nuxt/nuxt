/* eslint-disable no-console */
export default function mockLog(levels = 'all', logger = console) {
  if (levels === 'all') {
    levels = ['trace', 'debug', 'log', 'info', 'warn', 'error']
  }
  beforeAll(() => {
    for (let level of levels) {
      jest.spyOn(logger, level).mockImplementation(() => {})
    }
  })
  beforeEach(() => {
    for (let level of levels) {
      logger[level].mockClear()
    }
  })
  afterAll(() => {
    for (let level of levels) {
      logger[level].mockRestore()
    }
  })
  return logger
}
