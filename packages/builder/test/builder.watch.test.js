import chokidar from 'chokidar'
import upath from 'upath'
import debounce from 'lodash/debounce'
import { r, isString } from '@nuxt/utils'

import Builder from '../src/builder'
import { createNuxt } from './__utils__'

jest.mock('chokidar', () => ({
  watch: jest.fn().mockReturnThis(),
  on: jest.fn().mockReturnThis(),
  close: jest.fn().mockReturnThis()
}))
jest.mock('upath', () => ({ normalizeSafe: jest.fn(src => src) }))
jest.mock('lodash/debounce', () => jest.fn(fn => fn))
jest.mock('@nuxt/utils')
jest.mock('../src/ignore')

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

  test('should rewatch custom patterns when event is included in rewatchOnRawEvents', () => {
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
    rewatchHandler('change')

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
    builder.ignore.ignoreFile = '/var/nuxt/src/.nuxtignore'
    isString.mockImplementationOnce(src => typeof src === 'string')

    builder.watchRestart()

    expect(chokidar.watch).toBeCalledTimes(1)
    expect(chokidar.watch).toBeCalledWith(
      [
        'resolveAlias(/var/nuxt/src/middleware/test)',
        'resolveAlias(/var/nuxt/src/watch/test)',
        '/var/nuxt/src/.nuxtignore'
      ],
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
})
