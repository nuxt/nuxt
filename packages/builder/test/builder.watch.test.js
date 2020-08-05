import path from 'path'
import chokidar from 'chokidar'
import upath from 'upath'
import debounce from 'lodash/debounce'
import { r, isString, isPureObject } from '@nuxt/utils'

import { BundleBuilder } from '@nuxt/webpack'
import Builder from '../src/builder'
import { createNuxt } from './__utils__'
jest.mock('@nuxt/webpack')

jest.mock('chokidar', () => ({
  watch: jest.fn().mockReturnThis(),
  on: jest.fn().mockReturnThis(),
  close: jest.fn().mockReturnThis()
}))
jest.mock('upath', () => ({ normalizeSafe: jest.fn(src => src) }))
jest.mock('lodash/debounce', () => jest.fn(fn => fn))
jest.mock('@nuxt/utils')
jest.mock('../src/ignore')
jest.mock('@nuxt/webpack')

describe('builder: builder watch', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

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

    const builder = new Builder(nuxt, BundleBuilder)
    builder.createFileWatcher = jest.fn()
    builder.assignWatcher = jest.fn(() => () => {})
    r.mockImplementation((dir, src) => src)

    builder.watchClient()

    const patterns = [
      '/var/nuxt/src/layouts',
      '/var/nuxt/src/middleware'
    ]

    const globbedPatterns = [
      '/var/nuxt/src/layouts/**/*.{vue,js}',
      '/var/nuxt/src/middleware/**/*.{vue,js}'
    ]

    expect(r).toBeCalledTimes(2)
    expect(r).nthCalledWith(1, '/var/nuxt/src', patterns[0])
    expect(r).nthCalledWith(2, '/var/nuxt/src', patterns[1])

    expect(upath.normalizeSafe).toBeCalledTimes(2)
    expect(upath.normalizeSafe).nthCalledWith(1, globbedPatterns[0], 0, patterns)
    expect(upath.normalizeSafe).nthCalledWith(2, globbedPatterns[1], 1, patterns)

    expect(builder.createFileWatcher).toBeCalledTimes(1)
    expect(builder.createFileWatcher).toBeCalledWith(globbedPatterns, ['add', 'unlink'], expect.any(Function), expect.any(Function))
    expect(builder.assignWatcher).toBeCalledTimes(1)
  })

  test('should watch store files', () => {
    const nuxt = createNuxt()
    nuxt.options.store = true
    nuxt.options.srcDir = '/var/nuxt/src'
    nuxt.options.dir = {
      layouts: '/var/nuxt/src/layouts',
      pages: '/var/nuxt/src/pages',
      store: '/var/nuxt/src/store',
      middleware: '/var/nuxt/src/middleware'
    }
    nuxt.options.build.watch = []

    const builder = new Builder(nuxt, BundleBuilder)
    builder.createFileWatcher = jest.fn()
    builder.assignWatcher = jest.fn(() => () => {})
    r.mockImplementation((dir, src) => src)

    builder.watchClient()

    expect(r).toBeCalledTimes(3)
    expect(r).nthCalledWith(3, '/var/nuxt/src', '/var/nuxt/src/store')
  })

  test('should NOT watch pages files on client if _defaultPage=true', () => {
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

    const builder = new Builder(nuxt, BundleBuilder)
    builder._nuxtPages = true
    builder._defaultPage = true
    r.mockImplementation((dir, src) => src)

    builder.watchClient()

    expect(r).toBeCalledTimes(2)
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

    const builder = new Builder(nuxt, BundleBuilder)
    builder._nuxtPages = true
    r.mockImplementation((dir, src) => src)

    builder.watchClient()

    expect(r).toBeCalledTimes(3)
    expect(r).nthCalledWith(3, '/var/nuxt/src', '/var/nuxt/src/pages')

    expect(upath.normalizeSafe).toBeCalledTimes(3)
    expect(upath.normalizeSafe).nthCalledWith(3, '/var/nuxt/src/pages/**/*.{vue,js}', 2, expect.any(Array))
  })

  test('should invoke generateRoutesAndFiles on file refresh', () => {
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
    const builder = new Builder(nuxt, BundleBuilder)
    builder.watchCustom = jest.fn()
    r.mockImplementation((dir, src) => src)

    builder.watchClient()

    expect(debounce).toBeCalledTimes(1)
    expect(debounce).toBeCalledWith(expect.any(Function), 200)

    const refreshFiles = chokidar.on.mock.calls[0][1]
    builder.generateRoutesAndFiles = jest.fn()
    refreshFiles()
    expect(builder.generateRoutesAndFiles).toBeCalled()
  })

  test('should watch custom patterns', () => {
    const nuxt = createNuxt()
    nuxt.options.srcDir = '/var/nuxt/src'
    nuxt.options.dir = {
      layouts: '/var/nuxt/src/layouts',
      pages: '/var/nuxt/src/pages',
      store: '/var/nuxt/src/store',
      middleware: '/var/nuxt/src/middleware'
    }
    nuxt.options.build.watch = [
      '/var/nuxt/src/custom'
    ]
    nuxt.options.build.styleResources = [
      '/var/nuxt/src/style'
    ]
    const builder = new Builder(nuxt, BundleBuilder)
    builder.createFileWatcher = jest.fn()
    builder.assignWatcher = jest.fn(() => () => {})
    builder.watchClient()

    const patterns = [
      '/var/nuxt/src/custom',
      '/var/nuxt/src/style'
    ]

    expect(builder.createFileWatcher).toBeCalledTimes(3)
    expect(builder.createFileWatcher).toBeCalledWith(patterns, ['change'], expect.any(Function), expect.any(Function))
    expect(builder.assignWatcher).toBeCalledTimes(3)
  })

  test('should invoke chokidar to create watcher', () => {
    const nuxt = createNuxt()
    nuxt.options.srcDir = '/var/nuxt/src'
    nuxt.options.dir = {
      layouts: '/var/nuxt/src/layouts',
      pages: '/var/nuxt/src/pages',
      store: '/var/nuxt/src/store',
      middleware: '/var/nuxt/src/middleware'
    }
    nuxt.options.watchers = {
      chokidar: { test: true }
    }

    const patterns = ['/patterns']
    const events = ['event', 'another event']
    const listener = jest.fn()
    const watcherCreatedCallback = jest.fn()

    const builder = new Builder(nuxt, BundleBuilder)
    builder.createFileWatcher(patterns, events, listener, watcherCreatedCallback)

    expect(chokidar.watch).toBeCalledTimes(1)
    expect(chokidar.watch).toBeCalledWith(patterns, { test: true })
    expect(chokidar.on).toBeCalledTimes(2)
    expect(chokidar.on).nthCalledWith(1, 'event', listener)
    expect(chokidar.on).nthCalledWith(2, 'another event', listener)
    expect(watcherCreatedCallback).toBeCalledTimes(1)
  })

  test('should restart watcher when event is included in rewatchOnRawEvents', () => {
    const nuxt = createNuxt()
    nuxt.options.srcDir = '/var/nuxt/src'
    nuxt.options.dir = {
      layouts: '/var/nuxt/src/layouts',
      pages: '/var/nuxt/src/pages',
      store: '/var/nuxt/src/store',
      middleware: '/var/nuxt/src/middleware'
    }
    nuxt.options.watchers = {
      chokidar: { test: true },
      rewatchOnRawEvents: ['rename']
    }

    const patterns = ['/pattern']
    const events = ['event']
    const listener = jest.fn()
    const watcherCreatedCallback = jest.fn()

    const builder = new Builder(nuxt, BundleBuilder)
    builder.createFileWatcher(patterns, events, listener, watcherCreatedCallback)

    expect(chokidar.on).toBeCalledTimes(2)
    expect(chokidar.on).nthCalledWith(2, 'raw', expect.any(Function))

    const rewatchHandler = chokidar.on.mock.calls[1][1]
    rewatchHandler('rename')
    rewatchHandler('change')

    expect(chokidar.close).toBeCalledTimes(1)
    expect(builder.watchers.custom).toBeNull()
    expect(watcherCreatedCallback).toBeCalledTimes(2)
  })

  test('should watch files for restarting server', () => {
    const nuxt = createNuxt()
    nuxt.options.srcDir = '/var/nuxt/src'
    nuxt.options.dir = {
      layouts: '/var/nuxt/src/layouts',
      pages: '/var/nuxt/src/pages',
      store: '/var/nuxt/src/store',
      middleware: '/var/nuxt/src/middleware'
    }
    nuxt.options.watchers = {
      chokidar: { test: true }
    }
    nuxt.options.watch = [
      '/var/nuxt/src/watch/test'
    ]
    nuxt.options.serverMiddleware = [
      '/var/nuxt/src/serverMiddleware/test',
      { path: '/test', handler: '/var/nuxt/src/serverMiddleware/test-handler' },
      { obj: 'test' }
    ]
    const builder = new Builder(nuxt, BundleBuilder)
    builder.ignore.ignoreFile = '/var/nuxt/src/.nuxtignore'
    isString.mockImplementation(src => typeof src === 'string')
    isPureObject.mockImplementation(obj => typeof obj === 'object')

    builder.watchRestart()

    expect(chokidar.watch).toBeCalledTimes(1)
    expect(chokidar.watch).toBeCalledWith(
      [
        'resolveAlias(/var/nuxt/src/watch/test)',
        '/var/nuxt/src/.nuxtignore',
        path.join('/var/nuxt/src/var/nuxt/src/store') // because store == false + using path.join()
      ],
      { test: true }
    )
    expect(chokidar.on).toBeCalledTimes(1)
    expect(chokidar.on).toBeCalledWith('all', expect.any(Function))
  })

  test('should trigger restarting when files changed', async () => {
    const nuxt = createNuxt()
    nuxt.options.srcDir = '/var/nuxt/src'
    nuxt.options.dir = {
      layouts: '/var/nuxt/src/layouts',
      pages: '/var/nuxt/src/pages',
      store: '/var/nuxt/src/store',
      middleware: '/var/nuxt/src/middleware'
    }
    nuxt.options.watchers = {
      chokidar: { test: true }
    }
    nuxt.options.watch = [
      '/var/nuxt/src/watch/test'
    ]
    nuxt.options.serverMiddleware = []
    const builder = new Builder(nuxt, BundleBuilder)

    builder.watchRestart()

    const restartHandler = chokidar.on.mock.calls[0][1]
    const watchingFile = '/var/nuxt/src/watch/test/index.js'
    await restartHandler('add', watchingFile)
    await restartHandler('change', watchingFile)
    await restartHandler('unlink', watchingFile)

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
    nuxt.options.srcDir = '/var/nuxt/src'
    nuxt.options.dir = {
      layouts: '/var/nuxt/src/layouts',
      pages: '/var/nuxt/src/pages',
      store: '/var/nuxt/src/store',
      middleware: '/var/nuxt/src/middleware'
    }
    nuxt.options.watchers = {
      chokidar: { test: true }
    }
    nuxt.options.watch = [
      '/var/nuxt/src/watch/test'
    ]
    nuxt.options.serverMiddleware = []
    const builder = new Builder(nuxt, BundleBuilder)

    builder.watchRestart()

    const restartHandler = chokidar.on.mock.calls[0][1]
    const watchingFile = '/var/nuxt/src/watch/test/index.js'
    restartHandler('rename', watchingFile)

    expect(nuxt.callHook).not.toBeCalled()
  })

  test('should unwatch every watcher', () => {
    const nuxt = createNuxt()
    const builder = new Builder(nuxt, BundleBuilder)
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
    const builder = new Builder(nuxt, BundleBuilder)
    builder.unwatch = jest.fn()

    expect(builder.__closed).toBeUndefined()

    await builder.close()

    expect(builder.__closed).toEqual(true)
    expect(builder.unwatch).toBeCalledTimes(1)
    expect(builder.bundleBuilder.close).toBeCalledTimes(1)
  })

  test('should close bundleBuilder only if close api exists', async () => {
    const nuxt = createNuxt()
    const builder = new Builder(nuxt, { })
    builder.unwatch = jest.fn()

    expect(builder.__closed).toBeUndefined()

    await builder.close()

    expect(builder.__closed).toEqual(true)
    expect(builder.unwatch).toBeCalledTimes(1)
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

  test('should assign watcher with key', () => {
    const nuxt = createNuxt()
    const builder = new Builder(nuxt, BundleBuilder)

    const key = 'key'
    const watcher = 'watcher'

    const fn = builder.assignWatcher(key)
    fn(watcher)

    expect(Boolean(builder.watchers[key])).toBe(true)
    expect(builder.watchers[key]).toBe(watcher)
  })
})
