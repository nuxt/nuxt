const consola = require('consola')
const { buildFixture } = require('../../utils/build')

describe('with-config', () => {
  beforeAll(() => {
    consola.warn = jest.fn()
  })
  buildFixture('with-config', () => {
    expect(consola.warn).toHaveBeenCalledTimes(1)
    expect(consola.warn.mock.calls[0]).toMatchObject([{
      message: 'Found 2 plugins that match the configuration, suggest to specify extension:',
      additional: expect.stringContaining('plugins/test.json'),
      badge: true
    }])
  })
})
