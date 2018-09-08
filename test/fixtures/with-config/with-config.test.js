import consola from 'consola'
import { buildFixture } from '../../utils/build'

let customCompressionMiddlewareFunctionName
const hooks = [
  ['render:errorMiddleware', (app) => {
    customCompressionMiddlewareFunctionName = app.stack[0].handle.name
  }]
]

describe('with-config', () => {
  buildFixture('with-config', () => {
    expect(consola.warn).toHaveBeenCalledTimes(1)
    expect(consola.fatal).toHaveBeenCalledTimes(0)
    expect(consola.warn.mock.calls[0]).toMatchObject([{
      message: 'Found 2 plugins that match the configuration, suggest to specify extension:',
      additional: expect.stringContaining('plugins/test.json'),
      badge: true
    }])
    expect(customCompressionMiddlewareFunctionName).toBe('damn')
  }, hooks)
})
