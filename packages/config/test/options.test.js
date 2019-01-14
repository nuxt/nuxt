import path from 'path'
import consola from 'consola'
import * as options from '../src/options'

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

describe('config: options', () => {
  test('should return default nuxt config', () => {
    jest.spyOn(process, 'cwd').mockReturnValue('/var/nuxt/test')

    const config = options.getNuxtConfig({})
    delete config.modulesDir
    expect(config).toMatchSnapshot()

    process.cwd.mockRestore()
  })

  test('should prevent duplicate calls with same options', () => {
    const options = {}
    const firstConfig = options.getNuxtConfig(options)
    const secondConfig = options.getNuxtConfig(firstConfig)

    expect(firstConfig).toBe(secondConfig)
    expect(firstConfig.__normalized__).toBe(true)
  })

  test('should return default loading when loading is true', () => {
    const { loading } = options.getNuxtConfig({ loading: true })
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

  test('should transform transition/layoutTransition to name', () => {
    const { transition, layoutTransition } = options.getNuxtConfig({
      transition: 'test-tran',
      layoutTransition: 'test-layout-tran'
    })
    expect(transition).toMatchObject({ name: 'test-tran' })
    expect(layoutTransition).toMatchObject({ name: 'test-layout-tran' })
  })

  test('should transform extensions to array', () => {
    const { extensions } = options.getNuxtConfig({ extensions: 'ext' })
    expect(extensions).toEqual(['js', 'mjs', 'ts', 'ext'])
  })

  test('should support custom global name', () => {
    const { globalName } = options.getNuxtConfig({ globalName: 'globalNuxt' })
    expect(globalName).toEqual('globalnuxt')
  })

  test('should detect store dir', () => {
    const { store } = options.getNuxtConfig({ rootDir: path.resolve(__dirname, 'fixtures') })
    expect(store).toEqual(true)
  })

  test('should enable csp', () => {
    const { render: { csp } } = options.getNuxtConfig({ render: { csp: { allowedSources: true, test: true } } })
    expect(csp).toEqual({
      hashAlgorithm: 'sha256',
      allowedSources: true,
      policies: undefined,
      reportOnly: false,
      test: true
    })
  })

  test('should check unknown mode', () => {
    const { build, render } = options.getNuxtConfig({ mode: 'test' })
    expect(consola.warn).toHaveBeenCalledWith('Unknown mode: test. Falling back to universal')
    expect(build.ssr).toEqual(true)
    expect(render.ssr).toEqual(true)
  })

  test('should return 404.html as default generate.fallback', () => {
    const { generate: { fallback } } = options.getNuxtConfig({ generate: { fallback: true } })
    expect(fallback).toEqual('404.html')
  })

  describe('config: router dir', () => {
    test('should transform middleware to array', () => {
      const { router: { middleware } } = options.getNuxtConfig({ router: { middleware: 'midd' } })
      expect(middleware).toEqual(['midd'])
    })

    test('should set _routerBaseSpecified when base is specified', () => {
      const { _routerBaseSpecified } = options.getNuxtConfig({ router: { base: '/test' } })
      expect(_routerBaseSpecified).toEqual(true)
    })
  })

  describe('config: options dir', () => {
    test('should support custom root dir', () => {
      const { rootDir } = options.getNuxtConfig({
        rootDir: 'root'
      })
      expect(rootDir).toEqual(path.resolve('root'))
    })

    test('should support custom src dir', () => {
      const { srcDir } = options.getNuxtConfig({
        rootDir: 'root',
        srcDir: 'src'
      })
      expect(srcDir).toEqual(path.resolve('root', 'src'))
    })

    test('should support custom generate dir', () => {
      const { generate: { dir } } = options.getNuxtConfig({
        rootDir: 'root',
        generate: { dir: 'generate' }
      })
      expect(dir).toEqual(path.resolve('root', 'generate'))
    })
  })

  describe('config: options template', () => {
    test('should use default appTemplatePath', () => {
      const { appTemplatePath } = options.getNuxtConfig({})
      expect(appTemplatePath).toEqual(path.resolve('.nuxt', 'views', 'app.template.html'))
    })

    test('should use custom appTemplatePath', () => {
      const { appTemplatePath } = options.getNuxtConfig({ appTemplatePath: 'templates' })
      expect(appTemplatePath).toEqual(path.resolve('templates'))
    })

    test('should use custom app.html', () => {
      const { appTemplatePath } = options.getNuxtConfig({ rootDir: path.resolve(__dirname, 'fixtures') })
      expect(appTemplatePath).toEqual(path.resolve(__dirname, 'fixtures', 'app.html'))
    })
  })

  describe('config: options publicPath', () => {
    test('should fallback to default when publicPath is falsy', () => {
      const { build: { publicPath } } = options.getNuxtConfig({ build: { publicPath: false } })
      expect(publicPath).toEqual('/_nuxt/')
    })

    test('should append slash in publicPath', () => {
      const { build: { publicPath } } = options.getNuxtConfig({ build: { publicPath: '/nuxt_public' } })
      expect(publicPath).toEqual('/nuxt_public/')
    })

    test('should ignore url publicPath in dev', () => {
      const { build: { publicPath } } = options.getNuxtConfig({ dev: true, build: { publicPath: 'http://nuxt_public' } })
      expect(publicPath).toEqual('/_nuxt/')
    })
  })

  describe('config: options babel', () => {
    test('should replace and deprecate @nuxtjs/babel-preset-app', () => {
      const { build: { babel } } = options.getNuxtConfig({
        build: { babel: { presets: ['@nuxtjs/babel-preset-app'] } }
      })
      expect(consola.warn).toHaveBeenCalledWith('@nuxtjs/babel-preset-app has been deprecated, please use @nuxt/babel-preset-app.')
      expect(babel).toEqual({
        'babelrc': false,
        'cacheDirectory': false,
        'presets': ['@nuxt/babel-preset-app']
      })
    })

    test('should support options in babel presets', () => {
      const { build: { babel } } = options.getNuxtConfig({
        build: { babel: { presets: [['@nuxt/babel-preset-app', { test: true }]] } }
      })
      expect(babel).toEqual({
        'babelrc': false,
        'cacheDirectory': false,
        'presets': [['@nuxt/babel-preset-app', { test: true }]]
      })
    })
  })

  describe('config: options deprecated', () => {
    test('should deprecate render.gzip', () => {
      options.getNuxtConfig({ render: { gzip: true } })
      expect(consola.warn).toHaveBeenCalledWith('render.gzip is deprecated and will be removed in a future version! Please switch to render.compressor')
    })

    test('should deprecate build.vendor', () => {
      options.getNuxtConfig({ build: { vendor: ['lodash'] } })
      expect(consola.warn).toHaveBeenCalledWith('vendor has been deprecated due to webpack4 optimization')
    })

    test('should deprecate build.extractCSS.allChunks', () => {
      options.getNuxtConfig({ build: { extractCSS: { allChunks: true } } })
      expect(consola.warn).toHaveBeenCalledWith('build.extractCSS.allChunks has no effect from v2.0.0. Please use build.optimization.splitChunks settings instead.')
    })
  })
})
