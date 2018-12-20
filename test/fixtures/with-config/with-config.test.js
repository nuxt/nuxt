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
    expect(consola.warn).toHaveBeenCalledTimes(5)
    expect(consola.fatal).toHaveBeenCalledTimes(0)
    expect(consola.warn.mock.calls).toMatchObject([
      [
        'Unknown mode: unknown. Falling back to universal'
      ],
      [
        `Invalid plugin mode (server/client/all): 'abc'. Falling back to 'all'`
      ],
      [{
        message: 'Found 2 plugins that match the configuration, suggest to specify extension:',
        additional: expect.stringContaining('plugins/test.json')
      }],
      [
        'Using styleResources without the nuxt-style-resources-module is not suggested and can lead to severe performance issues.',
        'Please use https://github.com/nuxt-community/style-resources-module'
      ],
      [
        'Notice: Please do not deploy bundles built with analyze mode, it\'s only for analyzing purpose.'
      ]
    ])
    expect(customCompressionMiddlewareFunctionName).toBe('damn')
  }, hooks)
})

afterAll(() => {
  delete process.env.NUXT_ENV_FOO
})
