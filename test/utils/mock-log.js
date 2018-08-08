/* eslint-disable no-console */
export default function mockLog(levels = 'all', logger = console) {
  if (levels === 'all') {
    levels = ['trace', 'debug', 'log', 'info', 'warn', 'error']
  } else if (typeof levels === 'string') {
    levels = [levels]
  }
  beforeAll(() => {
    for (const level of levels) {
      jest.spyOn(logger, level).mockImplementation(() => {})
    }
  })
  beforeEach(() => {
    for (const level of levels) {
      logger[level].mockClear()
    }
  })
  afterAll(() => {
    for (const level of levels) {
      logger[level].mockRestore()
    }
  })
  return logger
}
