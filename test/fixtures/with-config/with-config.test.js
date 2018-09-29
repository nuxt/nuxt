import consola from 'consola'
import { buildFixture } from '../../utils/build'

beforeAll(() => {
  process.env.NUXT_ENV_FOO = 'manniL'
})

let customCompressionMiddlewareFunctionName
const hooks = [
  ['render:errorMiddleware', (app) => {
    customCompressionMiddlewareFunctionName = app.stack[0].handle.name
  }]
]

describe('with-config', () => {
  buildFixture('with-config', () => {
    expect(consola.warn).toHaveBeenCalledTimes(2)
    expect(consola.fatal).toHaveBeenCalledTimes(0)
    expect(consola.warn.mock.calls).toMatchObject([
      [{
        message: 'Found 2 plugins that match the configuration, suggest to specify extension:',
        additional: expect.stringContaining('plugins/test.json'),
        badge: true
      }],
      [{
        message: 'Notice: Please do not deploy bundles built with analyze mode, it\'s only for analyzing purpose.',
        badge: true
      }]
    ])
    expect(customCompressionMiddlewareFunctionName).toBe('damn')
  }, hooks)
})

afterAll(() => {
  delete process.env.NUXT_ENV_FOO
})
