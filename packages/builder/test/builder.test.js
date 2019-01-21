import Glob from 'glob'
import consola from 'consola'
import chokidar from 'chokidar'
import upath from 'upath'
import debounce from 'lodash/debounce'
import {
  r,
  wp,
  wChunk,
  createRoutes,
  relativeTo,
  waitFor,
  serializeFunction,
  determineGlobals,
  stripWhitespace,
  isString,
  isIndexFileAndFolder
} from '@nuxt/utils'
import { BundleBuilder } from '@nuxt/webpack'

import Builder from '../src/builder'
import BuildContext from '../src/context'

jest.mock('glob')
jest.mock('pify', () => fn => fn)
jest.mock('chokidar', () => ({
  watch: jest.fn().mockReturnThis(),
  on: jest.fn().mockReturnThis(),
  close: jest.fn().mockReturnThis()
}))
jest.mock('upath', () => ({
  normalizeSafe: jest.fn(src => src)
}))
jest.mock('hash-sum', () => src => `hash(${src})`)
jest.mock('lodash/debounce', () => jest.fn(fn => fn))
jest.mock('@nuxt/utils')
jest.mock('@nuxt/webpack', () => ({
  BundleBuilder: jest.fn(function () {
    this.name = 'webpack_builder'
  })
}))
jest.mock('../src/context', () => jest.fn(function () {
  this.name = 'build_context'
}))

const createNuxt = () => ({
  options: {
    globalName: 'global_name',
    globals: [],
    build: {}
  },
  hook: jest.fn(),
  callHook: jest.fn(),
  resolver: {
    requireModule: jest.fn(() => ({ template: 'builder-template' })),
    resolveAlias: jest.fn(src => `resolveAlias(${src})`)
  }
})

describe('builder: builder', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('builder: builder constructor', () => {
    test('should construct builder', () => {
      const nuxt = createNuxt()

      const bundleBuilder = {}
      determineGlobals.mockReturnValueOnce('__global')

      const builder = new Builder(nuxt, bundleBuilder)

      expect(builder.nuxt).toEqual(nuxt)
      expect(builder.plugins).toEqual([])
      expect(builder.options).toEqual(nuxt.options)

      expect(determineGlobals).toBeCalledTimes(1)
      expect(determineGlobals).toBeCalledWith(nuxt.options.globalName, nuxt.options.globals)

      expect(builder.watchers).toEqual({
        files: null,
        custom: null,
        restart: null
      })
      expect(builder.supportedExtensions).toEqual(['vue', 'js', 'ts', 'tsx'])
      expect(builder.relativeToBuild).toBeInstanceOf(Function)

      expect(builder._buildStatus).toEqual(1)

      expect(nuxt.resolver.requireModule).toBeCalledTimes(1)
      expect(nuxt.resolver.requireModule).toBeCalledWith('@nuxt/vue-app')
      expect(builder.template).toEqual('builder-template')

      expect(builder.bundleBuilder).toBe(bundleBuilder)
    })

    test('should call relativeTo in relativeToBuild', () => {
      const nuxt = createNuxt()
      nuxt.options.buildDir = '/var/nuxt/build'
      const bundleBuilder = {}
      const builder = new Builder(nuxt, bundleBuilder)

      const args = [{}, {}]
      builder.relativeToBuild(...args)

      expect(relativeTo).toBeCalledTimes(1)
      expect(relativeTo).toBeCalledWith('/var/nuxt/build', ...args)
    })

    test('should add hooks in dev mode', () => {
      const nuxt = createNuxt()
      nuxt.options.dev = true

      const bundleBuilder = {}
      determineGlobals.mockReturnValueOnce('__global')

      const builder = new Builder(nuxt, bundleBuilder)

      expect(builder.options.dev).toEqual(true)

      expect(nuxt.hook).toBeCalledTimes(2)
      expect(nuxt.hook).toBeCalledWith('build:done', expect.any(Function))
      expect(nuxt.hook).toBeCalledWith('close', expect.any(Function))

      const doneHook = nuxt.hook.mock.calls[0][1]
      builder.watchClient = jest.fn()
      builder.watchRestart = jest.fn()
      doneHook()
      expect(consola.info).toBeCalledTimes(1)
      expect(consola.info).toBeCalledWith('Waiting for file changes')
      expect(builder.watchClient).toBeCalledTimes(1)
      expect(builder.watchRestart).toBeCalledTimes(1)

      const closeHook = nuxt.hook.mock.calls[1][1]
      builder.close = jest.fn()
      closeHook()
      expect(builder.close).toBeCalledTimes(1)
    })

    test('should add hooks in analyze mode', () => {
      const nuxt = createNuxt()
      nuxt.options.build.analyze = true

      const bundleBuilder = {}
      const builder = new Builder(nuxt, bundleBuilder)

      expect(builder.options.build.analyze).toEqual(true)

      expect(nuxt.hook).toBeCalledTimes(1)
      expect(nuxt.hook).toBeCalledWith('build:done', expect.any(Function))

      const doneHook = nuxt.hook.mock.calls[0][1]
      doneHook()
      expect(consola.warn).toBeCalledTimes(1)
      expect(consola.warn).toBeCalledWith('Notice: Please do not deploy bundles built with analyze mode, it\'s only for analyzing purpose.')
    })

    test('should support function template', () => {
      const nuxt = createNuxt()
      nuxt.options.build.template = jest.fn()
      const bundleBuilder = {}
      const builder = new Builder(nuxt, bundleBuilder)

      expect(builder.template).toBe(nuxt.options.build.template)
      expect(nuxt.resolver.requireModule).not.toBeCalled()
    })
  })

  describe('builder: builder plugins', () => {
    test('should normalize plugins', () => {
      const nuxt = createNuxt()
      nuxt.options.plugins = [
        '/var/nuxt/plugins/test.js',
        { src: '/var/nuxt/plugins/test.server', mode: 'server' },
        { src: '/var/nuxt/plugins/test.client', ssr: false }
      ]
      const builder = new Builder(nuxt, {})

      const plugins = builder.normalizePlugins()

      expect(plugins).toEqual([
        {
          mode: 'all',
          name: 'nuxt_plugin_test_hash(/var/nuxt/plugins/test.js)',
          src: 'resolveAlias(/var/nuxt/plugins/test.js)'
        },
        {
          mode: 'server',
          name: 'nuxt_plugin_test_hash(/var/nuxt/plugins/test.server)',
          src: 'resolveAlias(/var/nuxt/plugins/test.server)'
        },
        {
          mode: 'client',
          name: 'nuxt_plugin_test_hash(/var/nuxt/plugins/test.client)',
          src: 'resolveAlias(/var/nuxt/plugins/test.client)'
        }
      ])
    })

    test('should warning and fallback invalid mode when normalize plugins', () => {
      const nuxt = createNuxt()
      nuxt.options.plugins = [
        { src: '/var/nuxt/plugins/test', mode: 'abc' }
      ]
      const builder = new Builder(nuxt, {})

      const plugins = builder.normalizePlugins()

      expect(plugins).toEqual([
        {
          mode: 'all',
          name: 'nuxt_plugin_test_hash(/var/nuxt/plugins/test)',
          src: 'resolveAlias(/var/nuxt/plugins/test)'
        }
      ])
      expect(consola.warn).toBeCalledTimes(1)
      expect(consola.warn).toBeCalledWith("Invalid plugin mode (server/client/all): 'abc'. Falling back to 'all'")
    })

    test('should resolve plugins', async () => {
      const nuxt = createNuxt()
      const builder = new Builder(nuxt, {})
      builder.plugins = [
        { src: '/var/nuxt/plugins/test.js', mode: 'all' },
        { src: '/var/nuxt/plugins/test.client', mode: 'client' },
        { src: '/var/nuxt/plugins/test.server', mode: 'server' }
      ]
      builder.relativeToBuild = jest.fn(src => `relative(${src})`)
      for (let step = 0; step < builder.plugins.length; step++) {
        Glob.mockImplementationOnce(src => [`${src.replace(/\{.*\}/, '')}.js`])
      }

      await builder.resolvePlugins()

      expect(Glob).toBeCalledTimes(3)
      expect(Glob).nthCalledWith(1, '/var/nuxt/plugins/test.js{?(.+([^.])),/index.+([^.])}')
      expect(Glob).nthCalledWith(2, '/var/nuxt/plugins/test.client{?(.+([^.])),/index.+([^.])}')
      expect(Glob).nthCalledWith(3, '/var/nuxt/plugins/test.server{?(.+([^.])),/index.+([^.])}')
      expect(builder.plugins).toEqual([
        { mode: 'all', src: 'relative(/var/nuxt/plugins/test.js)' },
        { mode: 'client', src: 'relative(/var/nuxt/plugins/test.client)' },
        { mode: 'server', src: 'relative(/var/nuxt/plugins/test.server)' }
      ])
    })

    test('should throw error if plugin no existed', () => {
      const nuxt = createNuxt()
      const builder = new Builder(nuxt, {})
      builder.plugins = [
        { src: '/var/nuxt/plugins/test.js', mode: 'all' }
      ]
      Glob.mockImplementationOnce(() => [])

      expect(builder.resolvePlugins()).rejects.toThrow('Plugin not found: /var/nuxt/plugins/test.js')
    })

    test('should warn if there are multiple files and not index', async () => {
      const nuxt = createNuxt()
      const builder = new Builder(nuxt, {})
      builder.plugins = [
        { src: '/var/nuxt/plugins/test', mode: 'all' }
      ]
      builder.relativeToBuild = jest.fn(src => `relative(${src})`)

      Glob.mockImplementationOnce(src => [`${src}.js`, `${src}.ts`])
      isIndexFileAndFolder.mockReturnValueOnce(false)

      await builder.resolvePlugins()

      expect(builder.plugins).toEqual([
        { mode: 'all', src: 'relative(/var/nuxt/plugins/test)' }
      ])
    })

    test('should detect plugin mode for client/server plugins', async () => {
      const nuxt = createNuxt()
      const builder = new Builder(nuxt, {})
      builder.plugins = [
        { src: '/var/nuxt/plugins/test.js', mode: 'all' },
        { src: '/var/nuxt/plugins/test.client', mode: 'all' },
        { src: '/var/nuxt/plugins/test.server', mode: 'all' }
      ]
      builder.relativeToBuild = jest.fn(src => `relative(${src})`)
      for (let step = 0; step < builder.plugins.length; step++) {
        Glob.mockImplementationOnce(src => [`${src.replace(/\{.*\}/, '')}.js`])
      }

      await builder.resolvePlugins()

      expect(builder.plugins).toEqual([
        { mode: 'all', src: 'relative(/var/nuxt/plugins/test.js)' },
        { mode: 'client', src: 'relative(/var/nuxt/plugins/test.client)' },
        { mode: 'server', src: 'relative(/var/nuxt/plugins/test.server)' }
      ])
    })
  })

  describe('builder: builder build', () => {
  })

  describe('builder: builder generate', () => {
  })

  describe('builder: builder watch', () => {
    test('should watch client files', () => {
      const nuxt = createNuxt()
      nuxt.options.srcDir = '/var/nuxt/src'
      nuxt.options.dir = {
        layouts: '/var/nuxt/src/layouts',
        pages: '/var/nuxt/src/pages',
        store: '/var/nuxt/src/store',
        middleware: '/var/nuxt/src/middleware'
      }
      nuxt.options.build.watch = []
      nuxt.options.watchers = {
        chokidar: { test: true }
      }
      const builder = new Builder(nuxt, {})
      r.mockImplementation((dir, src) => src)

      builder.watchClient()

      const patterns = [
        '/var/nuxt/src/layouts',
        '/var/nuxt/src/store',
        '/var/nuxt/src/middleware',
        '/var/nuxt/src/layouts/*.{vue,js,ts,tsx}',
        '/var/nuxt/src/layouts/**/*.{vue,js,ts,tsx}'
      ]

      expect(r).toBeCalledTimes(5)
      expect(r).nthCalledWith(1, '/var/nuxt/src', '/var/nuxt/src/layouts')
      expect(r).nthCalledWith(2, '/var/nuxt/src', '/var/nuxt/src/store')
      expect(r).nthCalledWith(3, '/var/nuxt/src', '/var/nuxt/src/middleware')
      expect(r).nthCalledWith(4, '/var/nuxt/src', '/var/nuxt/src/layouts/*.{vue,js,ts,tsx}')
      expect(r).nthCalledWith(5, '/var/nuxt/src', '/var/nuxt/src/layouts/**/*.{vue,js,ts,tsx}')

      expect(upath.normalizeSafe).toBeCalledTimes(5)
      expect(upath.normalizeSafe).nthCalledWith(1, '/var/nuxt/src/layouts', 0, patterns)
      expect(upath.normalizeSafe).nthCalledWith(2, '/var/nuxt/src/store', 1, patterns)
      expect(upath.normalizeSafe).nthCalledWith(3, '/var/nuxt/src/middleware', 2, patterns)
      expect(upath.normalizeSafe).nthCalledWith(4, '/var/nuxt/src/layouts/*.{vue,js,ts,tsx}', 3, patterns)
      expect(upath.normalizeSafe).nthCalledWith(5, '/var/nuxt/src/layouts/**/*.{vue,js,ts,tsx}', 4, patterns)

      expect(chokidar.watch).toBeCalledTimes(1)
      expect(chokidar.watch).toBeCalledWith(patterns, { test: true })
      expect(chokidar.on).toBeCalledTimes(2)
      expect(chokidar.on).nthCalledWith(1, 'add', expect.any(Function))
      expect(chokidar.on).nthCalledWith(2, 'unlink', expect.any(Function))
    })

    test('should watch pages files', () => {
      const nuxt = createNuxt()
      nuxt.options.srcDir = '/var/nuxt/src'
      nuxt.options.dir = {
        layouts: '/var/nuxt/src/layouts',
        pages: '/var/nuxt/src/pages',
        store: '/var/nuxt/src/store',
        middleware: '/var/nuxt/src/middleware'
      }
      nuxt.options.build.watch = []
      nuxt.options.watchers = {
        chokidar: { test: true }
      }
      const builder = new Builder(nuxt, {})
      builder._nuxtPages = true
      r.mockImplementation((dir, src) => src)

      builder.watchClient()

      expect(r).toBeCalledTimes(8)
      expect(r).nthCalledWith(6, '/var/nuxt/src', '/var/nuxt/src/pages')
      expect(r).nthCalledWith(7, '/var/nuxt/src', '/var/nuxt/src/pages/*.{vue,js,ts,tsx}')
      expect(r).nthCalledWith(8, '/var/nuxt/src', '/var/nuxt/src/pages/**/*.{vue,js,ts,tsx}')
    })

    test('should watch custom in watchClient', () => {
      const nuxt = createNuxt()
      nuxt.options.srcDir = '/var/nuxt/src'
      nuxt.options.dir = {
        layouts: '/var/nuxt/src/layouts',
        pages: '/var/nuxt/src/pages',
        store: '/var/nuxt/src/store',
        middleware: '/var/nuxt/src/middleware'
      }
      nuxt.options.build.watch = []
      nuxt.options.watchers = {
        chokidar: { test: true }
      }
      const builder = new Builder(nuxt, {})
      builder.watchCustom = jest.fn()
      r.mockImplementation((dir, src) => src)

      builder.watchClient()

      expect(debounce).toBeCalledTimes(1)
      expect(debounce).toBeCalledWith(expect.any(Function), 200)

      const refreshFiles = chokidar.on.mock.calls[0][1]
      builder.generateRoutesAndFiles = jest.fn()
      refreshFiles()
      expect(builder.generateRoutesAndFiles).toBeCalled()
      expect(builder.watchCustom).toBeCalledTimes(1)
      expect(builder.watchCustom).toBeCalledWith(refreshFiles)
    })

    test('should watch custom patterns', () => {
      const nuxt = createNuxt()
      nuxt.options.watchers = {
        chokidar: { test: true }
      }
      nuxt.options.build.watch = [
        '/var/nuxt/src/custom'
      ]
      nuxt.options.build.styleResources = [
        '/var/nuxt/src/style'
      ]
      const builder = new Builder(nuxt, {})
      const refreshFiles = jest.fn()

      builder.watchCustom(refreshFiles)

      expect(chokidar.watch).toBeCalledTimes(1)
      expect(chokidar.watch).toBeCalledWith(
        ['/var/nuxt/src/custom', '/var/nuxt/src/style'],
        { test: true }
      )
      expect(chokidar.on).toBeCalledTimes(1)
      expect(chokidar.on).toBeCalledWith('change', refreshFiles)
    })

    test('should call refreshFiles before watching custom patterns', () => {
      const nuxt = createNuxt()
      nuxt.options.watchers = {
        chokidar: { test: true }
      }
      nuxt.options.build.watch = [
        '/var/nuxt/src/custom'
      ]
      const builder = new Builder(nuxt, {})
      const refreshFiles = jest.fn()

      builder.watchCustom(refreshFiles, true)

      expect(refreshFiles).toBeCalledTimes(1)
    })

    test('should rewatch custom patterns when rewatchOnRawEvents is array', () => {
      const nuxt = createNuxt()
      nuxt.options.watchers = {
        chokidar: { test: true },
        rewatchOnRawEvents: ['rename']
      }
      nuxt.options.build.watch = [
        '/var/nuxt/src/custom'
      ]
      const builder = new Builder(nuxt, {})
      const refreshFiles = jest.fn()

      builder.watchCustom(refreshFiles)

      expect(chokidar.on).toBeCalledTimes(2)
      expect(chokidar.on).nthCalledWith(2, 'raw', expect.any(Function))

      const rewatchHandler = chokidar.on.mock.calls[1][1]
      builder.watchCustom = jest.fn()
      rewatchHandler('rename')

      expect(chokidar.close).toBeCalledTimes(1)
      expect(builder.watchers.custom).toBeNull()
      expect(builder.watchCustom).toBeCalledTimes(1)
      expect(builder.watchCustom).toBeCalledWith(refreshFiles, true)
    })

    test('should watch files for restarting server', () => {
      const nuxt = createNuxt()
      nuxt.options.watchers = {
        chokidar: { test: true }
      }
      nuxt.options.watch = [
        '/var/nuxt/src/watch/test'
      ]
      nuxt.options.serverMiddleware = [
        '/var/nuxt/src/middleware/test',
        { obj: 'test' }
      ]
      const builder = new Builder(nuxt, {})
      isString.mockImplementationOnce(src => typeof src === 'string')

      builder.watchRestart()

      expect(chokidar.watch).toBeCalledTimes(1)
      expect(chokidar.watch).toBeCalledWith(
        ['resolveAlias(/var/nuxt/src/middleware/test)', 'resolveAlias(/var/nuxt/src/watch/test)'],
        { test: true }
      )
      expect(chokidar.on).toBeCalledTimes(1)
      expect(chokidar.on).toBeCalledWith('all', expect.any(Function))
    })

    test('should trigger restarting when files changed', () => {
      const nuxt = createNuxt()
      nuxt.options.watchers = {
        chokidar: { test: true }
      }
      nuxt.options.watch = [
        '/var/nuxt/src/watch/test'
      ]
      nuxt.options.serverMiddleware = []
      const builder = new Builder(nuxt, {})

      builder.watchRestart()

      const restartHandler = chokidar.on.mock.calls[0][1]
      const watchingFile = '/var/nuxt/src/watch/test/index.js'
      restartHandler('add', watchingFile)
      restartHandler('change', watchingFile)
      restartHandler('unlink', watchingFile)

      expect(nuxt.callHook).toBeCalledTimes(6)
      expect(nuxt.callHook).nthCalledWith(1, 'watch:fileChanged', builder, watchingFile)
      expect(nuxt.callHook).nthCalledWith(2, 'watch:restart', { event: 'add', path: watchingFile })
      expect(nuxt.callHook).nthCalledWith(3, 'watch:fileChanged', builder, watchingFile)
      expect(nuxt.callHook).nthCalledWith(4, 'watch:restart', { event: 'change', path: watchingFile })
      expect(nuxt.callHook).nthCalledWith(5, 'watch:fileChanged', builder, watchingFile)
      expect(nuxt.callHook).nthCalledWith(6, 'watch:restart', { event: 'unlink', path: watchingFile })
    })

    test('should ignore other events in watchRestart', () => {
      const nuxt = createNuxt()
      nuxt.options.watchers = {
        chokidar: { test: true }
      }
      nuxt.options.watch = [
        '/var/nuxt/src/watch/test'
      ]
      nuxt.options.serverMiddleware = []
      const builder = new Builder(nuxt, {})

      builder.watchRestart()

      const restartHandler = chokidar.on.mock.calls[0][1]
      const watchingFile = '/var/nuxt/src/watch/test/index.js'
      restartHandler('rename', watchingFile)

      expect(nuxt.callHook).not.toBeCalled()
    })

    test('should unwatch every watcher', () => {
      const nuxt = createNuxt()
      const builder = new Builder(nuxt, {})
      builder.watchers = {
        files: { close: jest.fn() },
        custom: { close: jest.fn() },
        restart: { close: jest.fn() }
      }

      builder.unwatch()

      expect(builder.watchers.files.close).toBeCalledTimes(1)
      expect(builder.watchers.custom.close).toBeCalledTimes(1)
      expect(builder.watchers.restart.close).toBeCalledTimes(1)
    })

    test('should close watch and bundle builder', async () => {
      const nuxt = createNuxt()
      const bundleBuilderClose = jest.fn()
      const builder = new Builder(nuxt, { close: bundleBuilderClose })
      builder.unwatch = jest.fn()

      expect(builder.__closed).toBeUndefined()

      await builder.close()

      expect(builder.__closed).toEqual(true)
      expect(builder.unwatch).toBeCalledTimes(1)
      expect(bundleBuilderClose).toBeCalledTimes(1)
    })

    test('should prevent duplicate close', async () => {
      const nuxt = createNuxt()
      const bundleBuilderClose = jest.fn()
      const builder = new Builder(nuxt, { close: bundleBuilderClose })
      builder.unwatch = jest.fn()
      builder.__closed = true

      await builder.close()

      expect(builder.unwatch).not.toBeCalled()
      expect(bundleBuilderClose).not.toBeCalled()
    })
  })

  test('should get webpack builder by default', () => {
    const builder = new Builder(createNuxt(), {})

    const bundleBuilder = builder.getBundleBuilder()

    expect(BuildContext).toBeCalledTimes(1)
    expect(BuildContext).toBeCalledWith(builder)
    expect(BundleBuilder).toBeCalledTimes(1)
    expect(BundleBuilder).toBeCalledWith({ name: 'build_context' })
    expect(bundleBuilder).toEqual({ name: 'webpack_builder' })
  })

  test('should get custom builder from given constructor', () => {
    const builder = new Builder(createNuxt(), {})

    const CustomBundleBuilder = jest.fn(function () {
      this.name = 'custom_builder'
    })
    const bundleBuilder = builder.getBundleBuilder(CustomBundleBuilder)

    expect(BuildContext).toBeCalledTimes(1)
    expect(BuildContext).toBeCalledWith(builder)
    expect(CustomBundleBuilder).toBeCalledTimes(1)
    expect(CustomBundleBuilder).toBeCalledWith({ name: 'build_context' })
    expect(bundleBuilder).toEqual({ name: 'custom_builder' })
  })

  test('should call bundleBuilder forGenerate', () => {
    const bundleBuilder = {
      forGenerate: jest.fn()
    }
    const builder = new Builder(createNuxt(), bundleBuilder)

    builder.forGenerate()

    expect(bundleBuilder.forGenerate).toBeCalledTimes(1)
  })
})
