import { consola } from '../utils'
import { mockNuxt, mockBuilder, mockGetNuxtConfig } from '../utils/mocking'

describe('dev', () => {
  let dev

  beforeAll(async () => {
    dev = await import('../../src/commands/dev')
    dev = dev.default
  })

  afterEach(() => {
    jest.resetAllMocks()
  })

  test('is function', () => {
    expect(typeof dev).toBe('function')
  })

  test('reloads on fileChanged hook', async () => {
    const Nuxt = mockNuxt()
    const Builder = mockBuilder()

    await dev()

    expect(consola.error).not.toHaveBeenCalled()

    expect(Builder.prototype.build).toHaveBeenCalled()
    expect(Nuxt.prototype.listen).toHaveBeenCalled()
    expect(Nuxt.prototype.showReady).toHaveBeenCalled()
    expect(Builder.prototype.watchServer).toHaveBeenCalled()

    jest.resetAllMocks()

    const builder = new Builder()
    builder.nuxt = new Nuxt()
    await Nuxt.fileChangedHook(builder)
    expect(consola.debug).toHaveBeenCalled()

    expect(Nuxt.prototype.clearHook).toHaveBeenCalled()
    expect(Builder.prototype.unwatch).toHaveBeenCalled()
    expect(Builder.prototype.build).toHaveBeenCalled()
    expect(Nuxt.prototype.close).toHaveBeenCalled()
    expect(Nuxt.prototype.listen).toHaveBeenCalled()
    expect(Nuxt.prototype.showReady).not.toHaveBeenCalled()
    expect(Builder.prototype.watchServer).toHaveBeenCalled()

    expect(consola.error).not.toHaveBeenCalled()
  })

  test('catches build error', async () => {
    const Nuxt = mockNuxt()
    const Builder = mockBuilder()

    await dev()
    jest.resetAllMocks()

    // Test error on second build so we cover oldInstance.close
    const builder = new Builder()
    builder.nuxt = new Nuxt()
    Builder.prototype.build = jest.fn().mockImplementationOnce(() => Promise.reject(new Error('Build Error')))
    await Nuxt.fileChangedHook(builder)

    expect(Nuxt.prototype.close).toHaveBeenCalled()
    expect(consola.error).toHaveBeenCalledWith(new Error('Build Error'))
  })

  test('catches watchServer error', async () => {
    const Nuxt = mockNuxt()
    const Builder = mockBuilder()

    await dev()
    jest.resetAllMocks()

    const builder = new Builder()
    builder.nuxt = new Nuxt()
    Builder.prototype.watchServer = jest.fn().mockImplementationOnce(() => Promise.reject(new Error('watchServer Error')))
    await Nuxt.fileChangedHook(builder)

    expect(consola.error).toHaveBeenCalledWith(new Error('watchServer Error'))
    expect(Builder.prototype.watchServer.mock.calls.length).toBe(2)
  })

  test('catches error on hook error', async () => {
    const Nuxt = mockNuxt()
    const Builder = mockBuilder()

    await dev()
    jest.resetAllMocks()

    mockGetNuxtConfig().mockImplementationOnce(() => {
      throw new Error('Config Error')
    })
    const builder = new Builder()
    builder.nuxt = new Nuxt()
    await Nuxt.fileChangedHook(builder)

    expect(consola.error).toHaveBeenCalledWith(new Error('Config Error'))
    expect(Builder.prototype.watchServer.mock.calls.length).toBe(1)
  })
})
