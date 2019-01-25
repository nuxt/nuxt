import path from 'path'
import chalk from 'chalk'
import consola from 'consola'
import fsExtra from 'fs-extra'
import htmlMinifier from 'html-minifier'
import { flatRoutes, isString, isUrl, promisifyRoute, waitFor } from '@nuxt/utils'

import Generator from '../src/generator'

jest.mock('chalk', () => ({
  red: jest.fn(str => `red:${str}`),
  yellow: jest.fn(str => `yellow:${str}`),
  grey: jest.fn(str => `grey:${str}`)
}))
jest.mock('fs-extra')
jest.mock('html-minifier')
jest.mock('@nuxt/utils')

const createNuxt = () => ({
  ready: jest.fn(),
  callHook: jest.fn(),
  server: {
    renderRoute: jest.fn(() => ({ html: 'rendered html' }))
  },
  options: {
    srcDir: '/var/nuxt/src',
    buildDir: '/var/nuxt/build',
    generate: { dir: '/var/nuxt/generate' },
    build: { publicPath: '__public' },
    dir: { static: '/var/nuxt/static' }
  }
})

describe('generator: generator', () => {
  beforeAll(() => {
    path.sep = '[sep]'
    isString.mockImplementation(str => typeof str === 'string')
    jest.spyOn(path, 'join').mockImplementation((...args) => `join(${args.join(', ')})`)
    jest.spyOn(path, 'resolve').mockImplementation((...args) => `resolve(${args.join(', ')})`)
    jest.spyOn(path, 'dirname').mockImplementation((...args) => `dirname(${args.join(', ')})`)
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
    expect(generator.staticRoutes).toEqual('resolve(/var/nuxt/src, /var/nuxt/static)')
    expect(generator.srcBuiltPath).toBe('resolve(/var/nuxt/build, dist, client)')
    expect(generator.distPath).toBe('/var/nuxt/generate')
    expect(generator.distNuxtPath).toBe('join(/var/nuxt/generate, )')
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

    expect(generator.distNuxtPath).toBe('join(/var/nuxt/generate, __public)')
  })

  test('should generate with build and init by default', async () => {
    const nuxt = createNuxt()
    const builder = jest.fn()
    const generator = new Generator(nuxt, builder)

    const routes = ['routes']
    const errors = ['errors']
    generator.initiate = jest.fn()
    generator.initRoutes = jest.fn(() => routes)
    generator.generateRoutes = jest.fn(() => errors)
    generator.afterGenerate = jest.fn()

    await generator.generate()

    expect(consola.debug).toBeCalledTimes(2)
    expect(consola.debug).nthCalledWith(1, 'Initializing generator...')
    expect(consola.debug).nthCalledWith(2, 'Preparing routes for generate...')
    expect(generator.initiate).toBeCalledTimes(1)
    expect(generator.initiate).toBeCalledWith({ build: true, init: true })
    expect(generator.initRoutes).toBeCalledTimes(1)
    expect(consola.info).toBeCalledTimes(1)
    expect(consola.info).toBeCalledWith('Generating pages')
    expect(generator.generateRoutes).toBeCalledTimes(1)
    expect(generator.generateRoutes).toBeCalledWith(routes)
    expect(generator.afterGenerate).toBeCalledTimes(1)
    expect(nuxt.callHook).toBeCalledTimes(1)
    expect(nuxt.callHook).toBeCalledWith('generate:done', generator, errors)
  })

  test('should generate without build and init when disabled', async () => {
    const nuxt = createNuxt()
    const builder = jest.fn()
    const generator = new Generator(nuxt, builder)

    const routes = ['routes']
    const errors = ['errors']
    generator.initiate = jest.fn()
    generator.initRoutes = jest.fn(() => routes)
    generator.generateRoutes = jest.fn(() => errors)
    generator.afterGenerate = jest.fn()

    await generator.generate({ build: false, init: false })

    expect(generator.initiate).toBeCalledTimes(1)
    expect(generator.initiate).toBeCalledWith({ build: false, init: false })
  })

  test('should initiate with build and init by default', async () => {
    const nuxt = createNuxt()
    const builder = { forGenerate: jest.fn(), build: jest.fn() }
    const generator = new Generator(nuxt, builder)

    generator.initDist = jest.fn()

    await generator.initiate()

    expect(nuxt.ready).toBeCalledTimes(1)
    expect(nuxt.callHook).toBeCalledTimes(1)
    expect(nuxt.callHook).toBeCalledWith('generate:before', generator, { dir: generator.distPath })
    expect(builder.forGenerate).toBeCalledTimes(1)
    expect(builder.build).toBeCalledTimes(1)
    expect(generator.initDist).toBeCalledTimes(1)
  })

  test('should initiate without build and init if disabled', async () => {
    const nuxt = createNuxt()
    const builder = { forGenerate: jest.fn(), build: jest.fn() }
    const generator = new Generator(nuxt, builder)

    generator.initDist = jest.fn()

    await generator.initiate({ build: false, init: false })

    expect(nuxt.ready).toBeCalledTimes(1)
    expect(nuxt.callHook).toBeCalledTimes(1)
    expect(nuxt.callHook).toBeCalledWith('generate:before', generator, { dir: generator.distPath })
    expect(builder.forGenerate).not.toBeCalled()
    expect(builder.build).not.toBeCalled()
    expect(generator.initDist).not.toBeCalled()
  })

  test('should init routes with generate.routes and router.routes', async () => {
    const nuxt = createNuxt()
    nuxt.options = {
      ...nuxt.options,
      generate: {
        ...nuxt.options.generate,
        exclude: [/test/],
        routes: ['/foo', '/foo/bar']
      },
      router: {
        mode: 'history',
        routes: ['/index', '/about', '/test']
      }
    }
    const generator = new Generator(nuxt)

    flatRoutes.mockImplementationOnce(routes => routes)
    promisifyRoute.mockImplementationOnce(routes => routes)
    generator.decorateWithPayloads = jest.fn(() => 'decoratedRoutes')

    const routes = await generator.initRoutes()

    expect(promisifyRoute).toBeCalledTimes(1)
    expect(promisifyRoute).toBeCalledWith(['/foo', '/foo/bar'])
    expect(flatRoutes).toBeCalledTimes(1)
    expect(flatRoutes).toBeCalledWith(['/index', '/about', '/test'])
    expect(generator.decorateWithPayloads).toBeCalledTimes(1)
    expect(generator.decorateWithPayloads).toBeCalledWith(['/index', '/about'], ['/foo', '/foo/bar'])
    expect(nuxt.callHook).toBeCalledTimes(1)
    expect(nuxt.callHook).toBeCalledWith('generate:extendRoutes', 'decoratedRoutes')
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
        mode: 'hash',
        routes: ['/index', '/about', '/test']
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
    expect(nuxt.callHook).toBeCalledTimes(1)
    expect(nuxt.callHook).toBeCalledWith('generate:extendRoutes', 'decoratedRoutes')
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

  test('should generate routes', async () => {
    const nuxt = createNuxt()
    nuxt.options.generate = {
      ...nuxt.options.generate,
      concurrency: 2,
      interval: 100
    }
    const routes = [
      { route: '/index', payload: { param: 'test-index' } },
      { route: '/about', payload: { param: 'test-about' } },
      { route: '/foo', payload: { param: 'test-foo' } },
      { route: '/bar', payload: { param: 'test-bar' } },
      { route: '/baz', payload: { param: 'test-baz' } }
    ]
    const generator = new Generator(nuxt)

    generator.generateRoute = jest.fn()
    jest.spyOn(routes, 'splice')

    const errors = await generator.generateRoutes(routes)

    expect(routes.splice).toBeCalledTimes(3)
    expect(routes.splice).toBeCalledWith(0, 2)
    expect(waitFor).toBeCalledTimes(5)
    expect(waitFor).nthCalledWith(1, 0)
    expect(waitFor).nthCalledWith(2, 100)
    expect(waitFor).nthCalledWith(3, 0)
    expect(waitFor).nthCalledWith(4, 100)
    expect(waitFor).nthCalledWith(5, 0)
    expect(generator.generateRoute).toBeCalledTimes(5)
    expect(generator.generateRoute).nthCalledWith(1, { route: '/index', payload: { param: 'test-index' }, errors })
    expect(generator.generateRoute).nthCalledWith(2, { route: '/about', payload: { param: 'test-about' }, errors })
    expect(generator.generateRoute).nthCalledWith(3, { route: '/foo', payload: { param: 'test-foo' }, errors })
    expect(generator.generateRoute).nthCalledWith(4, { route: '/bar', payload: { param: 'test-bar' }, errors })
    expect(generator.generateRoute).nthCalledWith(5, { route: '/baz', payload: { param: 'test-baz' }, errors })

    generator._formatErrors = jest.fn()
    errors.toString()

    expect(generator._formatErrors).toBeCalledTimes(1)
    expect(generator._formatErrors).toBeCalledWith(errors)

    routes.splice.mockRestore()
  })

  test('should format errors', () => {
    const nuxt = createNuxt()
    const generator = new Generator(nuxt)

    const errors = generator._formatErrors([
      { type: 'handled', route: '/foo', error: 'foo failed' },
      { type: 'unhandled', route: '/bar', error: { stack: 'bar failed' } }
    ])

    expect(chalk.yellow).toBeCalledTimes(1)
    expect(chalk.yellow).toBeCalledWith(' /foo\n\n')
    expect(chalk.red).toBeCalledTimes(1)
    expect(chalk.red).toBeCalledWith(' /bar\n\n')
    expect(chalk.grey).toBeCalledTimes(2)
    expect(chalk.grey).nthCalledWith(1, '"foo failed"\n')
    expect(chalk.grey).nthCalledWith(2, 'bar failed')
    expect(errors).toEqual(`yellow: /foo

grey:"foo failed"

red: /bar

grey:bar failed`)
  })

  test('should write fallback html after generate', async () => {
    const nuxt = createNuxt()
    nuxt.options.generate.fallback = 'fallback.html'
    const generator = new Generator(nuxt)
    path.join.mockClear()
    fsExtra.exists.mockReturnValueOnce(false)

    await generator.afterGenerate()

    expect(path.join).toBeCalledTimes(1)
    expect(path.join).toBeCalledWith(generator.distPath, 'fallback.html')
    expect(fsExtra.exists).toBeCalledTimes(1)
    expect(fsExtra.exists).toBeCalledWith(`join(${generator.distPath}, fallback.html)`)
    expect(nuxt.server.renderRoute).toBeCalledTimes(1)
    expect(nuxt.server.renderRoute).toBeCalledWith('/', { spa: true })
    expect(fsExtra.writeFile).toBeCalledTimes(1)
    expect(fsExtra.writeFile).toBeCalledWith(`join(${generator.distPath}, fallback.html)`, 'rendered html', 'utf8')
  })

  test('should disable writing fallback if fallback is empty or not string', async () => {
    const nuxt = createNuxt()
    const generator = new Generator(nuxt)
    path.join.mockClear()

    nuxt.options.generate.fallback = ''
    await generator.afterGenerate()

    nuxt.options.generate.fallback = jest.fn()
    await generator.afterGenerate()

    expect(path.join).not.toBeCalled()
    expect(fsExtra.exists).not.toBeCalled()
    expect(nuxt.server.renderRoute).not.toBeCalled()
    expect(fsExtra.writeFile).not.toBeCalled()
  })

  test('should disable writing fallback if fallback path is not existed', async () => {
    const nuxt = createNuxt()
    nuxt.options.generate.fallback = 'fallback.html'
    const generator = new Generator(nuxt)
    path.join.mockClear()
    fsExtra.exists.mockReturnValueOnce(true)

    await generator.afterGenerate()

    expect(path.join).toBeCalledTimes(1)
    expect(path.join).toBeCalledWith(generator.distPath, 'fallback.html')
    expect(fsExtra.exists).toBeCalledTimes(1)
    expect(fsExtra.exists).toBeCalledWith(`join(${generator.distPath}, fallback.html)`)
    expect(nuxt.server.renderRoute).not.toBeCalled()
    expect(fsExtra.writeFile).not.toBeCalled()
  })

  test('should disable writing fallback if fallback is empty or not string', async () => {
    const nuxt = createNuxt()
    const generator = new Generator(nuxt)
    path.join.mockClear()

    nuxt.options.generate.fallback = ''
    await generator.afterGenerate()

    nuxt.options.generate.fallback = jest.fn()
    await generator.afterGenerate()

    expect(path.join).not.toBeCalled()
    expect(fsExtra.exists).not.toBeCalled()
    expect(fsExtra.writeFile).not.toBeCalled()
  })

  test('should initialize destination folder', async () => {
    const nuxt = createNuxt()
    nuxt.options.generate.fallback = 'fallback.html'
    const generator = new Generator(nuxt)
    path.join.mockClear()
    path.resolve.mockClear()
    fsExtra.exists.mockReturnValueOnce(false)

    await generator.initDist()

    expect(fsExtra.remove).toBeCalledTimes(1)
    expect(fsExtra.remove).toBeCalledWith(generator.distPath)
    expect(nuxt.callHook).toBeCalledTimes(2)
    expect(nuxt.callHook).nthCalledWith(1, 'generate:distRemoved', generator)
    expect(fsExtra.exists).toBeCalledTimes(1)
    expect(fsExtra.exists).toBeCalledWith(generator.staticRoutes)
    expect(fsExtra.copy).toBeCalledTimes(1)
    expect(fsExtra.copy).toBeCalledWith(generator.srcBuiltPath, generator.distNuxtPath)
    expect(path.resolve).toBeCalledTimes(1)
    expect(path.resolve).toBeCalledWith(generator.distPath, '.nojekyll')
    expect(fsExtra.writeFile).toBeCalledTimes(1)
    expect(fsExtra.writeFile).toBeCalledWith(`resolve(${generator.distPath}, .nojekyll)`, '')
    expect(nuxt.callHook).nthCalledWith(2, 'generate:distCopied', generator)
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

  test('should generate route', async () => {
    const nuxt = createNuxt()
    nuxt.options.build.html = { minify: false }
    nuxt.options.generate.minify = undefined
    const generator = new Generator(nuxt)
    path.join.mockClear()

    const route = '/foo'
    const payload = {}
    const errors = []

    const returned = await generator.generateRoute({ route, payload, errors })

    expect(nuxt.server.renderRoute).toBeCalledTimes(1)
    expect(nuxt.server.renderRoute).toBeCalledWith('/foo', { _generate: true, payload })
    expect(path.join).toBeCalledTimes(2)
    expect(path.join).nthCalledWith(1, '[sep]', '/foo.html')
    expect(path.join).nthCalledWith(2, generator.distPath, 'join([sep], /foo.html)')
    expect(nuxt.callHook).toBeCalledTimes(2)
    expect(nuxt.callHook).nthCalledWith(1, 'generate:page', {
      route,
      html: 'rendered html',
      path: `join(${generator.distPath}, join([sep], /foo.html))`
    })
    expect(nuxt.callHook).nthCalledWith(2, 'generate:routeCreated', {
      route,
      errors: [],
      path: `join(${generator.distPath}, join([sep], /foo.html))`
    })
    expect(fsExtra.mkdirp).toBeCalledTimes(1)
    expect(fsExtra.mkdirp).toBeCalledWith(`dirname(join(${generator.distPath}, join([sep], /foo.html)))`)
    expect(fsExtra.writeFile).toBeCalledTimes(1)
    expect(fsExtra.writeFile).toBeCalledWith(`join(${generator.distPath}, join([sep], /foo.html))`, 'rendered html', 'utf8')
    expect(returned).toEqual(true)
  })

  test('should create unhandled error if render route has any exception', async () => {
    const nuxt = createNuxt()
    const error = new Error('render route failed')
    nuxt.server.renderRoute.mockImplementationOnce(() => {
      throw error
    })
    const generator = new Generator(nuxt)
    generator._formatErrors = jest.fn(() => `formatted errors`)

    const route = '/foo'
    const payload = {}
    const errors = []

    const returned = await generator.generateRoute({ route, payload, errors })

    expect(nuxt.server.renderRoute).toBeCalledTimes(1)
    expect(nuxt.server.renderRoute).toBeCalledWith('/foo', { _generate: true, payload })
    expect(nuxt.callHook).toBeCalledTimes(1)
    expect(nuxt.callHook).toBeCalledWith('generate:routeFailed', {
      route,
      errors: [{ type: 'unhandled', route, error }]
    })
    expect(generator._formatErrors).toBeCalledTimes(1)
    expect(generator._formatErrors).toBeCalledWith([{ type: 'unhandled', route, error }])
    expect(consola.error).toBeCalledTimes(1)
    expect(consola.error).toBeCalledWith('formatted errors')
    expect(errors).toEqual([{
      error,
      route,
      type: 'unhandled'
    }])
    expect(returned).toEqual(false)
  })

  test('should create handled error if render route failed', async () => {
    const nuxt = createNuxt()
    nuxt.options.build.html = { minify: false }
    nuxt.options.generate.minify = undefined
    const error = new Error('render route failed')
    nuxt.server.renderRoute.mockReturnValueOnce({
      html: 'renderer html',
      error
    })
    const generator = new Generator(nuxt)

    const route = '/foo'
    const payload = {}
    const errors = []

    const returned = await generator.generateRoute({ route, payload, errors })

    expect(consola.error).toBeCalledTimes(1)
    expect(consola.error).toBeCalledWith('Error generating /foo')
    expect(errors).toEqual([{
      error,
      route,
      type: 'handled'
    }])
    expect(returned).toEqual(true)
  })

  test('should warn generate.minify deprecation message', async () => {
    const nuxt = createNuxt()
    nuxt.options.build.html = { minify: false }
    nuxt.options.generate.minify = false
    const generator = new Generator(nuxt)

    const route = '/foo'

    const returned = await generator.generateRoute({ route })

    expect(consola.warn).toBeCalledTimes(1)
    expect(consola.warn).toBeCalledWith(
      'generate.minify has been deprecated and will be removed in the next major version. Use build.html.minify instead!'
    )
    expect(returned).toEqual(true)
  })

  test('should minify generated html', async () => {
    const nuxt = createNuxt()
    nuxt.options.build.html = { minify: { value: 'test-minify' } }
    nuxt.options.generate.minify = undefined
    const generator = new Generator(nuxt)
    htmlMinifier.minify.mockReturnValueOnce('minified rendered html')

    const route = '/foo'

    const returned = await generator.generateRoute({ route })

    expect(htmlMinifier.minify).toBeCalledTimes(1)
    expect(htmlMinifier.minify).toBeCalledWith('rendered html', { value: 'test-minify' })
    expect(fsExtra.writeFile).toBeCalledTimes(1)
    expect(fsExtra.writeFile).toBeCalledWith(`join(${generator.distPath}, join([sep], /foo.html))`, 'minified rendered html', 'utf8')
    expect(returned).toEqual(true)
  })

  test('should create unhandled error if minify failed', async () => {
    const nuxt = createNuxt()
    nuxt.options.build.html = { minify: { value: 'test-minify' } }
    nuxt.options.generate.minify = undefined
    const generator = new Generator(nuxt)
    htmlMinifier.minify.mockImplementationOnce(() => {
      throw new Error('minify html failed')
    })

    const route = '/foo'
    const errors = []

    const returned = await generator.generateRoute({ route, errors })

    expect(htmlMinifier.minify).toBeCalledTimes(1)
    expect(htmlMinifier.minify).toBeCalledWith('rendered html', { value: 'test-minify' })
    expect(errors).toEqual([{
      route,
      type: 'unhandled',
      error: new Error('HTML minification failed. Make sure the route generates valid HTML. Failed HTML:\n rendered html')
    }])
    expect(returned).toEqual(true)
  })

  test('should generate file in sub folder', async () => {
    const nuxt = createNuxt()
    nuxt.options.build.html = { minify: false }
    nuxt.options.generate.subFolders = true
    const generator = new Generator(nuxt)
    path.join.mockClear()

    const route = '/foo'

    const returned = await generator.generateRoute({ route })

    expect(path.join).toBeCalledTimes(2)
    expect(path.join).nthCalledWith(1, route, '[sep]', 'index.html')
    expect(path.join).nthCalledWith(2, generator.distPath, 'join(/foo, [sep], index.html)')
    expect(fsExtra.writeFile).toBeCalledTimes(1)
    expect(fsExtra.writeFile).toBeCalledWith(`join(${generator.distPath}, join(/foo, [sep], index.html))`, 'rendered html', 'utf8')
    expect(returned).toEqual(true)
  })

  test('should generate 404 file in flat folder', async () => {
    const nuxt = createNuxt()
    nuxt.options.build.html = { minify: false }
    nuxt.options.generate.subFolders = true
    const generator = new Generator(nuxt)
    path.join.mockClear()
    path.join.mockReturnValueOnce('/404/index.html')

    const route = '/404'

    const returned = await generator.generateRoute({ route })

    expect(path.join).toBeCalledTimes(2)
    expect(path.join).nthCalledWith(1, route, '[sep]', 'index.html')
    expect(path.join).nthCalledWith(2, generator.distPath, '/404.html')
    expect(fsExtra.writeFile).toBeCalledTimes(1)
    expect(fsExtra.writeFile).toBeCalledWith(`join(${generator.distPath}, /404.html)`, 'rendered html', 'utf8')
    expect(returned).toEqual(true)
  })

  test('should generate file in flat folder if route is epmty', async () => {
    const nuxt = createNuxt()
    nuxt.options.build.html = { minify: false }
    const generator = new Generator(nuxt)
    path.join.mockClear()

    const route = ''

    const returned = await generator.generateRoute({ route })

    expect(path.join).toBeCalledTimes(2)
    expect(path.join).nthCalledWith(1, '[sep]', 'index.html')
    expect(path.join).nthCalledWith(2, generator.distPath, 'join([sep], index.html)')
    expect(fsExtra.writeFile).toBeCalledTimes(1)
    expect(fsExtra.writeFile).toBeCalledWith(`join(${generator.distPath}, join([sep], index.html))`, 'rendered html', 'utf8')
    expect(returned).toEqual(true)
  })
})
