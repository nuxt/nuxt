import { TARGETS } from '@nuxt/utils'
import BuildContext from '../../src/context/build'

describe('builder: buildContext', () => {
  test('should construct context', () => {
    const builder = {
      nuxt: {
        options: {
          target: TARGETS.server
        }
      }
    }
    const context = new BuildContext(builder)
    expect(context._builder).toEqual(builder)
    expect(context.nuxt).toEqual(builder.nuxt)
    expect(context.options).toEqual(builder.nuxt.options)
    expect(context.target).toEqual('server')
  })

  test('should return builder plugins context', () => {
    const builder = {
      plugins: [],
      nuxt: { options: {} }
    }
    const context = new BuildContext(builder)
    expect(context.plugins).toEqual(builder.plugins)
  })

  test('should return builder build options', () => {
    const buildOptions = { id: 'test-build-options' }
    const builder = {
      plugins: [],
      nuxt: { options: { build: buildOptions } }
    }
    const context = new BuildContext(builder)
    expect(context.buildOptions).toEqual(buildOptions)
  })
})
