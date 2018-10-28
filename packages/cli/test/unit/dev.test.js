import { consola, mockNuxt, mockBuilder, mockGetNuxtConfig, wrapAndRun } from '../utils'

describe('dev', () => {
  let dev

  beforeAll(async () => {
    dev = await import('../../src/commands/dev').then(m => m.default)
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  test('has run function', () => {
    expect(typeof dev.run).toBe('function')
  })

  test('reloads on fileChanged hook', async () => {
    const Nuxt = mockNuxt()
    const Builder = mockBuilder()

    await wrapAndRun(dev)

    expect(consola.error).not.toHaveBeenCalled()

    expect(Builder.prototype.build).toHaveBeenCalled()
    expect(Nuxt.prototype.listen).toHaveBeenCalled()
    expect(Nuxt.prototype.showReady).toHaveBeenCalled()
    expect(Builder.prototype.watchServer).toHaveBeenCalled()

    jest.clearAllMocks()

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

    await wrapAndRun(dev)
    jest.clearAllMocks()

    // Test error on second build so we cover oldInstance stuff
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

    await wrapAndRun(dev)
    jest.clearAllMocks()

    const builder = new Builder()
    builder.nuxt = new Nuxt()
    Builder.prototype.watchServer = jest.fn().mockImplementationOnce(() => Promise.reject(new Error('watchServer Error')))
    await Nuxt.fileChangedHook(builder)

    expect(consola.error).toHaveBeenCalledWith(new Error('watchServer Error'))
    expect(Builder.prototype.watchServer).toHaveBeenCalledTimes(2)
  })

  test('catches error on hook error', async () => {
    const Nuxt = mockNuxt()
    const Builder = mockBuilder()

    await wrapAndRun(dev)
    jest.clearAllMocks()

    mockGetNuxtConfig().mockImplementationOnce(() => {
      throw new Error('Config Error')
    })
    const builder = new Builder()
    builder.nuxt = new Nuxt()
    await Nuxt.fileChangedHook(builder)

    expect(consola.error).toHaveBeenCalledWith(new Error('Config Error'))
    expect(Builder.prototype.watchServer).toHaveBeenCalledTimes(1)
  })

  test('catches error on startDev', async () => {
    mockNuxt({
      listen: jest.fn().mockImplementation(() => {
        throw new Error('Listen Error')
      })
    })
    mockBuilder()

    await wrapAndRun(dev)

    expect(consola.error).toHaveBeenCalledWith(new Error('Listen Error'))
  })
})
