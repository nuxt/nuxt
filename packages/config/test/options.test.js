import path from 'path'
import consola from 'consola'
import { getNuxtConfig } from '../src/options'

jest.mock('std-env', () => ({
  browser: false,
  test: 'test',
  dev: false,
  production: true,
  debug: false,
  ci: true,
  windows: false,
  darwin: false,
  linux: true
}))

jest.mock('@nuxt/utils', () => ({
  ...jest.requireActual('@nuxt/utils'),
  getMainModule: () => ({ paths: ['/var/nuxt/node_modules'] }),
  getPKG: () => ({ name: 'fake' })
}))

describe('config: options', () => {
  test('should return default nuxt config', () => {
    jest.spyOn(process, 'cwd').mockReturnValue('/var/nuxt/test')
    jest.spyOn(path, 'resolve').mockImplementation((...args) => args.join('/').replace(/\\+/, '/'))
    jest.spyOn(path, 'join').mockImplementation((...args) => args.join('/').replace(/\\+/, '/'))

    expect(getNuxtConfig({
      createRequire: jest.fn(),
      generate: {
        staticAssets: {
          version: 'x'
        }
      }
    })).toMatchSnapshot()

    process.cwd.mockRestore()
    path.resolve.mockRestore()
    path.join.mockRestore()
  })

  test('should prevent duplicate calls with same options', () => {
    const options = {}
    const firstConfig = getNuxtConfig(options)
    const secondConfig = getNuxtConfig(firstConfig)

    expect(firstConfig).toBe(secondConfig)
    expect(firstConfig.__normalized__).toBe(true)
  })

  test('should return default loading when loading is true', () => {
    const { loading } = getNuxtConfig({ loading: true })
    expect(loading).toEqual({
      color: 'black',
      failedColor: 'red',
      height: '2px',
      throttle: 200,
      duration: 5000,
      continuous: false,
      rtl: false,
      css: true
    })
  })

  test('[Compatibility] should transform transition to pageTransition', () => {
    const { pageTransition, transition } = getNuxtConfig({
      transition: 'test-tran'
    })
    expect(pageTransition).toMatchObject({ name: 'test-tran' })
    expect(transition).toBeUndefined()
  })

  test('should transform pageTransition/layoutTransition to name', () => {
    const { pageTransition, layoutTransition } = getNuxtConfig({
      pageTransition: 'test-tran',
      layoutTransition: 'test-layout-tran'
    })
    expect(pageTransition).toMatchObject({ name: 'test-tran' })
    expect(layoutTransition).toMatchObject({ name: 'test-layout-tran' })
  })

  test('should transform extensions to array', () => {
    const { extensions } = getNuxtConfig({ extensions: 'ext' })
    expect(extensions).toEqual(['js', 'mjs', 'ext'])
  })

  test('should support custom global name', () => {
    const { globalName } = getNuxtConfig({ globalName: 'globalNuxt' })
    expect(globalName).toEqual('globalnuxt')
  })

  test('should detect store dir', () => {
    const { store } = getNuxtConfig({ rootDir: path.resolve(__dirname, 'fixtures') })
    expect(store).toEqual(true)
  })

  test('should unset and warn when etag.hash not a function', () => {
    const { render: { etag } } = getNuxtConfig({ render: { etag: { hash: true } } })
    expect(etag).toMatchObject({ hash: undefined })
    expect(consola.warn).not.toHaveBeenCalledWith('render.etag.hash should be a function, received boolean instead')

    const { render: { etag: etagDev } } = getNuxtConfig({ dev: true, render: { etag: { hash: true } } })
    expect(etagDev).toMatchObject({ hash: undefined })
    expect(consola.warn).toHaveBeenCalledWith('render.etag.hash should be a function, received boolean instead')
  })

  test('should enable csp', () => {
    const { render: { csp } } = getNuxtConfig({ render: { csp: { allowedSources: ['/nuxt/*'], test: true } } })
    expect(csp).toEqual({
      hashAlgorithm: 'sha256',
      addMeta: false,
      unsafeInlineCompatibility: false,
      allowedSources: ['/nuxt/*'],
      policies: undefined,
      reportOnly: false,
      test: true
    })
  })

  // TODO: Remove this test in Nuxt 3, we will stop supporting this typo (more on: https://github.com/nuxt/nuxt.js/pull/6583)
  test('should enable csp with old typo property name, avoiding breaking changes', () => {
    const { render: { csp } } = getNuxtConfig({ render: { csp: { allowedSources: ['/nuxt/*'], test: true, unsafeInlineCompatiblity: true } } })
    expect(csp).toEqual({
      hashAlgorithm: 'sha256',
      addMeta: false,
      unsafeInlineCompatibility: true,
      allowedSources: ['/nuxt/*'],
      policies: undefined,
      reportOnly: false,
      test: true
    })
  })

  test('should fallback to server target', () => {
    const { target } = getNuxtConfig({ target: 0 })
    expect(target).toEqual('server')
  })

  test('should check unknown target', () => {
    const { target } = getNuxtConfig({ target: 'test' })
    expect(consola.warn).toHaveBeenCalledWith('Unknown target: test. Falling back to server')
    expect(target).toEqual('server')
  })

  test('should check unknown mode', () => {
    const { build, render } = getNuxtConfig({ mode: 'test' })
    expect(consola.warn).toHaveBeenCalledWith('Unknown mode: test. Falling back to universal')
    expect(build.ssr).toEqual(true)
    expect(render.ssr).toEqual(true)
  })

  test('should add appear true in pageTransition when no ssr', () => {
    const { pageTransition } = getNuxtConfig({ render: { ssr: false } })
    expect(pageTransition.appear).toEqual(true)
  })

  test('should return 200.html as default generate.fallback', () => {
    const { generate: { fallback } } = getNuxtConfig({})
    expect(fallback).toEqual('200.html')
  })

  test('should return 404.html when generate.fallback is true', () => {
    const { generate: { fallback } } = getNuxtConfig({ generate: { fallback: true } })
    expect(fallback).toEqual('404.html')
  })

  test('should return fallback html when generate.fallback is string', () => {
    const { generate: { fallback } } = getNuxtConfig({ generate: { fallback: 'fallback.html' } })
    expect(fallback).toEqual('fallback.html')
  })

  test('export should alias to generate', () => {
    const { generate: { fallback } } = getNuxtConfig({ export: { fallback: 'fallback.html' } })
    expect(fallback).toEqual('fallback.html')
  })

  test('should disable parallel if extractCSS is enabled', () => {
    const { build: { parallel } } = getNuxtConfig({ build: { extractCSS: true, parallel: true } })
    expect(parallel).toEqual(false)
    expect(consola.warn).toHaveBeenCalledWith('extractCSS cannot work with parallel build due to limited work pool in thread-loader')
  })

  describe('config: router dir', () => {
    test('should transform middleware to array', () => {
      const { router: { middleware } } = getNuxtConfig({ router: { middleware: 'midd' } })
      expect(middleware).toEqual(['midd'])
    })

    test('should set _routerBaseSpecified when base is specified', () => {
      const { _routerBaseSpecified } = getNuxtConfig({ router: { base: '/test' } })
      expect(_routerBaseSpecified).toEqual(true)
    })
  })

  describe('config: options dir', () => {
    test('should support custom root dir', () => {
      const { rootDir } = getNuxtConfig({
        rootDir: 'root'
      })
      expect(rootDir).toEqual(path.resolve('root'))
    })

    test('should support custom src dir', () => {
      const { srcDir } = getNuxtConfig({
        rootDir: 'root',
        srcDir: 'src'
      })
      expect(srcDir).toEqual(path.resolve('root', 'src'))
    })

    test('should support custom generate dir', () => {
      const { generate: { dir } } = getNuxtConfig({
        rootDir: 'root',
        generate: { dir: 'generate' }
      })
      expect(dir).toEqual(path.resolve('root', 'generate'))
    })
  })

  describe('config: options template', () => {
    test('should use default appTemplatePath', () => {
      const { appTemplatePath } = getNuxtConfig({})
      expect(appTemplatePath).toEqual(path.resolve('.nuxt', 'views', 'app.template.html'))
    })

    test('should use custom appTemplatePath', () => {
      const { appTemplatePath } = getNuxtConfig({ appTemplatePath: 'templates' })
      expect(appTemplatePath).toEqual(path.resolve('templates'))
    })

    test('should use custom app.html', () => {
      const { appTemplatePath } = getNuxtConfig({ rootDir: path.resolve(__dirname, 'fixtures') })
      expect(appTemplatePath).toEqual(path.resolve(__dirname, 'fixtures', 'app.html'))
    })
  })

  describe('config: options publicPath', () => {
    test('should fallback to default when publicPath is falsy', () => {
      const { build: { publicPath } } = getNuxtConfig({ build: { publicPath: false } })
      expect(publicPath).toEqual('/_nuxt/')
    })

    test('should append slash in publicPath', () => {
      const { build: { publicPath } } = getNuxtConfig({ build: { publicPath: '/nuxt_public' } })
      expect(publicPath).toEqual('/nuxt_public/')
    })

    test('should ignore url publicPath in dev', () => {
      const { build: { publicPath } } = getNuxtConfig({ dev: true, build: { publicPath: 'http://nuxt_public' } })
      expect(publicPath).toEqual('/_nuxt/')
    })
  })

  describe('config: options babel', () => {
    test('should replace and deprecate @nuxtjs/babel-preset-app', () => {
      const { build: { babel } } = getNuxtConfig({
        build: { babel: { presets: ['@nuxtjs/babel-preset-app'] } }
      })
      expect(consola.warn).toHaveBeenCalledWith('@nuxtjs/babel-preset-app has been deprecated, please use @nuxt/babel-preset-app.')
      expect(babel).toEqual({
        configFile: false,
        babelrc: false,
        cacheDirectory: false,
        presets: ['@nuxt/babel-preset-app']
      })
    })

    test('should support options in babel presets', () => {
      const { build: { babel } } = getNuxtConfig({
        build: { babel: { presets: [['@nuxt/babel-preset-app', { test: true }]] } }
      })
      expect(babel).toEqual({
        configFile: false,
        babelrc: false,
        cacheDirectory: false,
        presets: [['@nuxt/babel-preset-app', { test: true }]]
      })
    })
  })

  describe('config: options deprecated', () => {
    test('should deprecate render.gzip', () => {
      getNuxtConfig({ render: { gzip: true } })
      expect(consola.warn).toHaveBeenCalledWith('render.gzip is deprecated and will be removed in a future version! Please switch to render.compressor')
    })

    test('should deprecate build.vendor', () => {
      getNuxtConfig({ build: { vendor: ['lodash'] } })
      expect(consola.warn).toHaveBeenCalledWith('vendor has been deprecated due to webpack4 optimization')
    })

    test('should deprecate devModules', () => {
      const config = getNuxtConfig({ devModules: ['foo'], buildModules: ['bar'] })
      expect(consola.warn).toHaveBeenCalledWith('`devModules` has been renamed to `buildModules` and will be removed in Nuxt 3.')
      expect(config.devModules).toBe(undefined)
      expect(config.buildModules).toEqual(['bar', 'foo'])
    })

    test('should deprecate build.extractCSS.allChunks', () => {
      getNuxtConfig({ build: { extractCSS: { allChunks: true } } })
      expect(consola.warn).toHaveBeenCalledWith('build.extractCSS.allChunks has no effect from v2.0.0. Please use build.optimization.splitChunks settings instead.')
    })

    test('should deprecate build.crossorigin', () => {
      getNuxtConfig({ build: { crossorigin: 'use-credentials' } })
      expect(consola.warn).toHaveBeenCalledWith('Using `build.crossorigin` is deprecated and will be removed in Nuxt 3. Please use `render.crossorigin` instead.')
    })
  })
})

describe('config: serverMiddleware', () => {
  test('should transform serverMiddleware hash', () => {
    const serverMiddleware = {
      '/resource': (req, res, next) => {
      }
    }
    const config = getNuxtConfig({ serverMiddleware })
    expect(config.serverMiddleware[0].path).toBe('/resource')
    expect(config.serverMiddleware[0].handler).toBe(serverMiddleware['/resource'])
  })
})

describe('config: router', () => {
  test('should sanitize router.base', () => {
    const config = getNuxtConfig({ router: { base: '/foo' } })
    expect(config.router.base).toBe('/foo/')
  })
})
