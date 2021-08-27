import consola from 'consola'
import fsExtra from 'fs-extra'
import { flatRoutes, isString, isUrl, promisifyRoute } from '@nuxt/utils'

import Generator from '../src/generator'
import { createNuxt, hookCalls } from './__utils__'

jest.mock('fs-extra')
jest.mock('@nuxt/utils')

describe('generator: initialize', () => {
  beforeAll(() => {
    isString.mockImplementation(str => typeof str === 'string')
  })

  beforeEach(() => {
    jest.clearAllMocks()
  })

  test('should construct Generator', () => {
    isUrl.mockReturnValueOnce(true)
    const nuxt = createNuxt()
    nuxt.options = {
      ...nuxt.options,
      build: { publicPath: 'http://localhost:3000' }
    }
    const builder = jest.fn()
    const generator = new Generator(nuxt, builder)

    expect(generator.nuxt).toBe(nuxt)
    expect(generator.options).toBe(nuxt.options)
    expect(generator.builder).toBe(builder)
    expect(generator.staticRoutes).toBePath(
      '/var/nuxt/static',
      'C:\\nuxt\\static'
    )
    expect(generator.srcBuiltPath).toBePath(
      '/var/nuxt/build/dist/client',
      'C:\\nuxt\\build\\dist\\client'
    )
    expect(generator.distPath).toBePath(
      '/var/nuxt/generate',
      'C:\\nuxt\\generate'
    )
    expect(generator.distNuxtPath).toBePath(
      '/var/nuxt/generate',
      'C:\\nuxt\\generate'
    )
  })

  test('should append publicPath to distPath if publicPath is not url', () => {
    isUrl.mockReturnValueOnce(false)
    const nuxt = createNuxt()
    nuxt.options = {
      ...nuxt.options,
      build: { publicPath: '__public' }
    }
    const builder = jest.fn()
    const generator = new Generator(nuxt, builder)

    expect(generator.distNuxtPath).toBePath(
      '/var/nuxt/generate/__public',
      'C:\\nuxt\\generate\\__public'
    )
  })

  test('should initiate with build and init by default', async () => {
    const nuxt = createNuxt()
    const builder = { forGenerate: jest.fn(), build: jest.fn() }
    const generator = new Generator(nuxt, builder)

    generator.initDist = jest.fn()

    await generator.initiate()

    expect(nuxt.ready).toBeCalledTimes(1)
    expect(hookCalls(nuxt, 'generate:before')[0]).toMatchObject([generator, { dir: generator.distPath }])
    expect(builder.forGenerate).toBeCalledTimes(1)
    expect(builder.build).toBeCalledTimes(1)
    expect(generator.initDist).toBeCalledTimes(1)
  })

  test('should initiate without build and init if disabled', async () => {
    const nuxt = createNuxt()
    const builder = { forGenerate: jest.fn(), build: jest.fn() }
    const generator = new Generator(nuxt, builder)

    generator.initDist = jest.fn()
    fsExtra.exists.mockReturnValueOnce(true)
    generator.getBuildConfig = jest.fn(() => ({ ssr: true, target: 'static' }))

    await generator.initiate({ build: false, init: false })

    expect(nuxt.ready).toBeCalledTimes(1)
    expect(hookCalls(nuxt, 'generate:before')[0]).toMatchObject([generator, { dir: generator.distPath }])
    expect(builder.forGenerate).not.toBeCalled()
    expect(builder.build).not.toBeCalled()
    expect(generator.initDist).not.toBeCalled()
  })

  test('should throw error when build is not disabled, but Builder instance is omitted', async () => {
    const nuxt = createNuxt()
    const generator = new Generator(nuxt)

    await expect(generator.initiate()).rejects.toThrow('Could not generate')
  })

  test('should init routes with generate.routes and routes.json', async () => {
    const nuxt = createNuxt()
    nuxt.options = {
      ...nuxt.options,
      generate: {
        ...nuxt.options.generate,
        exclude: [/test/],
        routes: ['/foo', '/foo/bar']
      },
      router: {
        mode: 'history'
      }
    }
    const generator = new Generator(nuxt)

    flatRoutes.mockImplementationOnce(routes => routes)
    promisifyRoute.mockImplementationOnce(routes => routes)
    generator.getAppRoutes = jest.fn(() => ['/index', '/about', '/test'])
    generator.decorateWithPayloads = jest.fn(() => 'decoratedRoutes')

    const routes = await generator.initRoutes()

    expect(promisifyRoute).toBeCalledTimes(1)
    expect(promisifyRoute).toBeCalledWith(['/foo', '/foo/bar'])
    expect(flatRoutes).toBeCalledTimes(1)
    expect(flatRoutes).toBeCalledWith(['/index', '/about', '/test'])
    expect(generator.decorateWithPayloads).toBeCalledTimes(1)
    expect(generator.decorateWithPayloads).toBeCalledWith(['/index', '/about'], ['/foo', '/foo/bar'])
    expect(hookCalls(nuxt, 'generate:extendRoutes')[0][0]).toBe('decoratedRoutes')
    expect(routes).toEqual('decoratedRoutes')
  })

  test('should init routes with hash mode', async () => {
    const nuxt = createNuxt()
    nuxt.options = {
      ...nuxt.options,
      generate: {
        ...nuxt.options.generate,
        exclude: [/test/],
        routes: ['/foo', '/foo/bar']
      },
      router: {
        mode: 'hash'
      }
    }
    const generator = new Generator(nuxt)

    flatRoutes.mockImplementationOnce(routes => routes)
    promisifyRoute.mockImplementationOnce(routes => routes)
    generator.decorateWithPayloads = jest.fn(() => 'decoratedRoutes')

    const routes = await generator.initRoutes()

    expect(promisifyRoute).not.toBeCalled()
    expect(flatRoutes).not.toBeCalled()
    expect(generator.decorateWithPayloads).toBeCalledTimes(1)
    expect(generator.decorateWithPayloads).toBeCalledWith(['/'], [])
    expect(hookCalls(nuxt, 'generate:extendRoutes')[0][0]).toBe('decoratedRoutes')
    expect(routes).toEqual('decoratedRoutes')

    promisifyRoute.mockReset()
    flatRoutes.mockReset()
  })

  test('should throw error when route can not be resolved', async () => {
    const nuxt = createNuxt()
    nuxt.options.router = { mode: 'history' }
    const generator = new Generator(nuxt)

    promisifyRoute.mockImplementationOnce(() => {
      throw new Error('promisifyRoute failed')
    })

    await expect(generator.initRoutes()).rejects.toThrow('promisifyRoute failed')

    expect(promisifyRoute).toBeCalledTimes(1)
    expect(promisifyRoute).toBeCalledWith([])
    expect(consola.error).toBeCalledTimes(1)
    expect(consola.error).toBeCalledWith('Could not resolve routes')
  })

  test('should initialize destination folder', async () => {
    const nuxt = createNuxt()
    nuxt.options.generate.fallback = 'fallback.html'
    nuxt.options.generate.nojekyll = true
    const generator = new Generator(nuxt)
    fsExtra.exists.mockReturnValueOnce(false)

    await generator.initDist()

    expect(fsExtra.emptyDir).toBeCalledTimes(1)
    expect(fsExtra.emptyDir).toBeCalledWith(generator.distPath)
    expect(hookCalls(nuxt, 'generate:distRemoved')[0][0]).toMatchObject(generator)
    expect(fsExtra.exists).toBeCalledTimes(1)
    expect(fsExtra.exists).toBeCalledWith(generator.staticRoutes)
    expect(fsExtra.copy).toBeCalledTimes(1)
    expect(fsExtra.copy).toBeCalledWith(generator.srcBuiltPath, generator.distNuxtPath)
    expect(fsExtra.writeFile).toBeCalledTimes(1)
    expect(fsExtra.writeFile.mock.calls[0][0]).toBePath(
      '/var/nuxt/generate/.nojekyll',
      'C:\\nuxt\\generate\\.nojekyll'
    )
    expect(hookCalls(nuxt, 'generate:distCopied')[0][0]).toMatchObject(generator)
  })

  test('should copy static routes if path exists', async () => {
    const nuxt = createNuxt()
    nuxt.options.generate.fallback = 'fallback.html'
    const generator = new Generator(nuxt)
    fsExtra.exists.mockReturnValueOnce(true)

    await generator.initDist()

    expect(fsExtra.copy).toBeCalledTimes(2)
    expect(fsExtra.copy).nthCalledWith(1, generator.staticRoutes, generator.distPath)
    expect(fsExtra.copy).nthCalledWith(2, generator.srcBuiltPath, generator.distNuxtPath)
  })

  test('should decorate routes with payloads', () => {
    const nuxt = createNuxt()
    const generator = new Generator(nuxt)

    const routes = ['/index', '/about', '/test']
    const generateRoutes = ['/foo', { route: '/foo/bar', payload: { param: 'foo bar' } }]
    const routeMap = generator.decorateWithPayloads(routes, generateRoutes)

    expect(routeMap).toEqual([
      { payload: null, route: '/index' },
      { payload: null, route: '/about' },
      { payload: null, route: '/test' },
      { payload: null, route: '/foo' },
      { payload: { param: 'foo bar' }, route: '/foo/bar' }
    ])
  })
})
