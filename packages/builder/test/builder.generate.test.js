import path from 'path'
import Glob from 'glob'
import fs from 'fs-extra'
import consola from 'consola'
import template from 'lodash/template'
import { r, createRoutes, stripWhitespace } from '@nuxt/utils'
import { BundleBuilder } from '@nuxt/webpack'
import Builder from '../src/builder'
import TemplateContext from '../src/context/template'
import { createNuxt } from './__utils__'

jest.mock('glob')
jest.mock('pify', () => fn => fn)
jest.mock('fs-extra')
jest.mock('lodash/template')
jest.mock('@nuxt/utils')
jest.mock('../src/context/template', () => jest.fn())
jest.mock('../src/ignore', () => function () {
  this.filter = jest.fn(files => files)
})
jest.mock('@nuxt/webpack')

describe('builder: builder generate', () => {
  beforeAll(() => {
    r.mockImplementation((...args) => `r(${args.join(', ')})`)
    fs.readFile.mockImplementation((...args) => `readFile(${args.join(', ')})`)
    fs.outputFile.mockImplementation((...args) => `outputFile(${args.join(', ')})`)
    const { join, resolve } = path.posix
    jest.spyOn(path, 'join').mockImplementation((...args) => join(...args))
    jest.spyOn(path, 'resolve').mockImplementation((...args) => resolve(...args))
  })

  afterAll(() => {
    path.join.mockRestore()
    path.resolve.mockRestore()
  })

  beforeEach(() => {
    jest.clearAllMocks()
  })

  test('should generate routes and files', async () => {
    const nuxt = createNuxt()
    nuxt.options.build = {
      template: {
        dir: '/var/nuxt/src/template',
        files: ['App.js', 'index.js']
      },
      watch: []
    }

    const builder = new Builder(nuxt, BundleBuilder)
    builder.normalizePlugins = jest.fn(() => [{ name: 'test_plugin', src: '/var/somesrc' }])
    builder.resolveLayouts = jest.fn(() => 'resolveLayouts')
    builder.resolveRoutes = jest.fn(() => 'resolveRoutes')
    builder.resolveStore = jest.fn(() => 'resolveStore')
    builder.resolveMiddleware = jest.fn(() => 'resolveMiddleware')
    builder.addOptionalTemplates = jest.fn()
    builder.resolveCustomTemplates = jest.fn()
    builder.resolveLoadingIndicator = jest.fn()
    builder.compileTemplates = jest.fn()
    jest.spyOn(Promise, 'all').mockImplementation(() => {})

    await builder.generateRoutesAndFiles()

    expect(consola.debug).toBeCalledTimes(1)
    expect(consola.debug).toBeCalledWith('Generating nuxt files')
    expect(TemplateContext).toBeCalledTimes(1)
    expect(TemplateContext).toBeCalledWith(builder, builder.options)
    expect(builder.normalizePlugins).toBeCalledTimes(1)
    expect(builder.resolveLayouts).toBeCalledTimes(1)
    expect(builder.resolveRoutes).toBeCalledTimes(1)
    expect(builder.resolveStore).toBeCalledTimes(1)
    expect(builder.resolveMiddleware).toBeCalledTimes(1)
    expect(Promise.all).toBeCalledTimes(1)
    expect(Promise.all).toBeCalledWith([
      'resolveLayouts',
      'resolveRoutes',
      'resolveStore',
      'resolveMiddleware'
    ])
    expect(builder.addOptionalTemplates).toBeCalledTimes(1)
    expect(builder.resolveCustomTemplates).toBeCalledTimes(1)
    expect(builder.resolveLoadingIndicator).toBeCalledTimes(1)
    expect(builder.options.build.watch).toEqual([])
    expect(builder.compileTemplates).toBeCalledTimes(1)
    expect(consola.success).toBeCalledTimes(1)
    expect(consola.success).toBeCalledWith('Nuxt files generated')

    Promise.all.mockRestore()
  })

  test('should resolve files', async () => {
    const nuxt = createNuxt()
    nuxt.options.srcDir = '/var/nuxt/src'
    nuxt.options.ignore = '/var/nuxt/ignore'
    const builder = new Builder(nuxt, BundleBuilder)
    Glob.mockReturnValue('matched files')

    const files = await builder.resolveFiles('/var/nuxt/dir')

    expect(Glob).toBeCalledTimes(1)
    expect(Glob).toBeCalledWith(
      '/var/nuxt/dir/**/*.{vue,js}',
      { cwd: '/var/nuxt/src' }
    )
    expect(builder.ignore.filter).toBeCalledTimes(1)
    expect(builder.ignore.filter).toBeCalledWith('matched files')
    expect(files).toEqual('matched files')
  })

  test('should resolve relative files', async () => {
    const nuxt = createNuxt()
    const builder = new Builder(nuxt, BundleBuilder)
    builder.resolveFiles = jest.fn(dir => [`${dir}/foo.vue`, `${dir}/bar.vue`, `${dir}/baz.vue`])

    const files = await builder.resolveRelative('/var/nuxt/dir')

    expect(builder.resolveFiles).toBeCalledTimes(1)
    expect(builder.resolveFiles).toBeCalledWith('/var/nuxt/dir')
    expect(files).toEqual([
      { src: 'foo.vue' },
      { src: 'bar.vue' },
      { src: 'baz.vue' }
    ])
  })

  test('should resolve store modules', async () => {
    const nuxt = createNuxt()
    nuxt.options.features = { store: true }
    nuxt.options.store = true
    nuxt.options.dir = {
      store: '/var/nuxt/src/store'
    }
    const builder = new Builder(nuxt, BundleBuilder)
    builder.resolveRelative = jest.fn(dir => [
      { src: `${dir}/index.js` },
      { src: `${dir}/bar.js` },
      { src: `${dir}/baz.js` },
      { src: `${dir}/foo/bar.js` },
      { src: `${dir}/foo/baz.js` },
      { src: `${dir}/foo/index.js` }
    ])

    const templateVars = {}
    const templateFiles = []
    await builder.resolveStore({ templateVars, templateFiles })

    expect(templateVars.storeModules).toEqual([
      { src: '/var/nuxt/src/store/index.js' },
      { src: '/var/nuxt/src/store/bar.js' },
      { src: '/var/nuxt/src/store/baz.js' },
      { src: '/var/nuxt/src/store/foo/index.js' },
      { src: '/var/nuxt/src/store/foo/bar.js' },
      { src: '/var/nuxt/src/store/foo/baz.js' }]
    )
    expect(templateFiles).toEqual(['store.js'])
  })

  test('should disable store resolving when not set', async () => {
    const nuxt = createNuxt()
    nuxt.options.features = { store: false }
    nuxt.options.dir = {
      store: '/var/nuxt/src/store'
    }
    const builder = new Builder(nuxt, BundleBuilder)

    const templateVars = {}
    const templateFiles = []
    await builder.resolveStore({ templateVars, templateFiles })

    expect(templateVars.storeModules).toBeUndefined()
    expect(templateFiles).toEqual([])
  })

  test('should disable store resolving when feature disabled', async () => {
    const nuxt = createNuxt()
    nuxt.options.features = { store: false }
    nuxt.options.store = true
    nuxt.options.dir = {
      store: '/var/nuxt/src/store'
    }
    const builder = new Builder(nuxt, BundleBuilder)

    const templateVars = {}
    const templateFiles = []
    await builder.resolveStore({ templateVars, templateFiles })

    expect(templateVars.storeModules).toBeUndefined()
    expect(templateFiles).toEqual([])
  })

  test('should resolve middleware', async () => {
    const nuxt = createNuxt()
    nuxt.options.features = { middleware: true }
    nuxt.options.store = false
    nuxt.options.srcDir = '/var/nuxt/src'
    nuxt.options.dir = {
      middleware: 'middleware'
    }
    const middlewarePath = 'subfolder/midd.js'
    const builder = new Builder(nuxt, BundleBuilder)
    builder.resolveRelative = jest.fn(dir => [
      { src: middlewarePath }
    ])
    builder.relativeToBuild = jest.fn().mockReturnValue(middlewarePath)

    const templateVars = {}
    const templateFiles = []
    await builder.resolveMiddleware({ templateVars, templateFiles })

    expect(templateVars.middleware).toEqual([
      {
        name: 'subfolder/midd',
        src: 'subfolder/midd.js',
        dst: 'subfolder/midd.js'
      }
    ])
    expect(templateFiles).toEqual(['middleware.js'])
  })

  test('should disable middleware when feature disabled', async () => {
    const nuxt = createNuxt()
    nuxt.options.features = { middleware: false }
    nuxt.options.store = false
    nuxt.options.dir = {
      middleware: '/var/nuxt/src/middleware'
    }
    const builder = new Builder(nuxt, BundleBuilder)
    const templateVars = {}
    const templateFiles = []
    await builder.resolveMiddleware({ templateVars, templateFiles })
    expect(templateFiles).toEqual([])
  })

  test('should custom templates', async () => {
    const nuxt = createNuxt()
    nuxt.options.srcDir = '/var/nuxt/src'
    nuxt.options.build = {
      watch: [],
      template: { dir: '/var/nuxt/templates' },
      templates: [
        '/var/nuxt/templates/foo.js',
        { src: '/var/nuxt/templates/bar.js' },
        { src: '/var/nuxt/templates/baz.js', dst: 'baz.js' }
      ]
    }
    const builder = new Builder(nuxt, BundleBuilder)
    fs.exists.mockReturnValueOnce(true)

    const templateContext = {
      templateFiles: [
        'foo.js',
        'bar.js',
        'baz.js',
        'router.js',
        'store.js',
        'middleware.js'
      ]
    }
    await builder.resolveCustomTemplates(templateContext)

    expect(templateContext.templateFiles).toEqual([
      { custom: true, dst: 'foo.js', src: '/var/nuxt/src/app/foo.js', options: {} },
      { custom: true, dst: 'bar.js', src: '/var/nuxt/templates/bar.js', options: {} },
      { custom: true, dst: 'baz.js', src: '/var/nuxt/templates/baz.js', options: {} },
      { custom: false, dst: 'router.js', src: 'r(/var/nuxt/templates, router.js)', options: {} },
      { custom: false, dst: 'store.js', src: 'r(/var/nuxt/templates, store.js)', options: {} },
      { custom: false, dst: 'middleware.js', src: 'r(/var/nuxt/templates, middleware.js)', options: {} }
    ])
  })

  test('should resolve loading indicator', async () => {
    const nuxt = createNuxt()
    nuxt.options.loadingIndicator = {
      name: 'test_loading_indicator'
    }
    nuxt.options.build = {
      watch: [],
      template: { dir: '/var/nuxt/templates' }
    }
    const builder = new Builder(nuxt, BundleBuilder)
    fs.exists.mockReturnValueOnce(true)

    const templateFiles = []
    await builder.resolveLoadingIndicator({ templateFiles })

    expect(path.resolve).toBeCalledTimes(1)
    expect(path.resolve).toBeCalledWith('/var/nuxt/templates', 'views/loading', 'test_loading_indicator.html')
    expect(fs.exists).toBeCalledTimes(1)
    expect(fs.exists).toBeCalledWith('/var/nuxt/templates/views/loading/test_loading_indicator.html')
    expect(templateFiles).toEqual([{
      custom: false,
      dst: 'loading.html',
      options: { name: 'test_loading_indicator' },
      src: '/var/nuxt/templates/views/loading/test_loading_indicator.html'
    }])
  })

  test('should resolve alias loading indicator', async () => {
    const nuxt = createNuxt()
    nuxt.options.loadingIndicator = {
      name: '@/app/template.vue'
    }
    nuxt.options.build = {
      watch: [],
      template: { dir: '/var/nuxt/templates' }
    }
    const builder = new Builder(nuxt, BundleBuilder)
    fs.exists
      .mockReturnValueOnce(false)
      .mockReturnValueOnce(true)

    const templateFiles = []
    await builder.resolveLoadingIndicator({ templateFiles })

    expect(path.resolve).toBeCalledTimes(1)
    expect(path.resolve).toBeCalledWith('/var/nuxt/templates', 'views/loading', '@/app/template.vue.html')
    expect(fs.exists).toBeCalledTimes(2)
    expect(fs.exists).nthCalledWith(1, '/var/nuxt/templates/views/loading/@/app/template.vue.html')
    expect(fs.exists).nthCalledWith(2, 'resolveAlias(@/app/template.vue)')
    expect(templateFiles).toEqual([{
      custom: true,
      dst: 'loading.html',
      options: { name: '@/app/template.vue' },
      src: 'resolveAlias(@/app/template.vue)'
    }])
  })

  test('should display error if three is not loading indicator', async () => {
    const nuxt = createNuxt()
    nuxt.options.loadingIndicator = {
      name: '@/app/empty.vue'
    }
    nuxt.options.build = {
      watch: [],
      template: { dir: '/var/nuxt/templates' }
    }
    const builder = new Builder(nuxt, BundleBuilder)
    fs.exists
      .mockReturnValueOnce(false)
      .mockReturnValueOnce(false)

    const templateFiles = []
    await builder.resolveLoadingIndicator({ templateFiles })

    expect(path.resolve).toBeCalledTimes(1)
    expect(path.resolve).toBeCalledWith('/var/nuxt/templates', 'views/loading', '@/app/empty.vue.html')
    expect(fs.exists).toBeCalledTimes(2)
    expect(fs.exists).nthCalledWith(1, '/var/nuxt/templates/views/loading/@/app/empty.vue.html')
    expect(fs.exists).nthCalledWith(2, 'resolveAlias(@/app/empty.vue)')
    expect(consola.error).toBeCalledTimes(1)
    expect(consola.error).toBeCalledWith('Could not fetch loading indicator: @/app/empty.vue')
    expect(templateFiles).toEqual([])
  })

  test('should disable loading indicator', async () => {
    const nuxt = createNuxt()
    nuxt.options.loadingIndicator = {
      name: false
    }
    const builder = new Builder(nuxt, BundleBuilder)

    await builder.resolveLoadingIndicator({ templateFiles: [] })

    expect(path.resolve).not.toBeCalled()
  })

  test('should compile templates', async () => {
    const nuxt = createNuxt()
    nuxt.options.build.watch = []
    nuxt.options.buildDir = '/var/nuxt/build'
    const builder = new Builder(nuxt, BundleBuilder)
    builder.relativeToBuild = jest.fn()
    const templateFn = jest.fn(() => 'compiled content')
    template.mockImplementation(() => templateFn)
    stripWhitespace.mockImplementation(content => `trim(${content})`)

    const templateContext = {
      templateVars: { test: 'template_vars' },
      templateFiles: [
        { src: '/var/nuxt/src/foo.js', dst: 'foo.js', options: { foo: true } },
        { src: '/var/nuxt/src/bar.js', dst: 'bar.js', options: { bar: true } },
        { src: '/var/nuxt/src/baz.js', dst: 'baz.js', custom: true }
      ],
      templateOptions: {}
    }
    await builder.compileTemplates(templateContext)

    expect(nuxt.callHook).toBeCalledTimes(1)
    expect(nuxt.callHook).toBeCalledWith('build:templates', {
      templateVars: templateContext.templateVars,
      templatesFiles: templateContext.templateFiles,
      resolve: r
    })
    expect(templateContext.templateOptions.imports).toEqual({
      resolvePath: nuxt.resolver.resolvePath,
      resolveAlias: nuxt.resolver.resolveAlias,
      relativeToBuild: builder.relativeToBuild
    })
    expect(nuxt.options.build.watch).toEqual(['/var/nuxt/src/baz.js'])
    expect(fs.readFile).toBeCalledTimes(3)
    expect(fs.readFile).nthCalledWith(1, '/var/nuxt/src/foo.js', 'utf8')
    expect(fs.readFile).nthCalledWith(2, '/var/nuxt/src/bar.js', 'utf8')
    expect(fs.readFile).nthCalledWith(3, '/var/nuxt/src/baz.js', 'utf8')
    expect(template).toBeCalledTimes(3)
    expect(template).nthCalledWith(1, 'readFile(/var/nuxt/src/foo.js, utf8)', templateContext.templateOptions)
    expect(template).nthCalledWith(2, 'readFile(/var/nuxt/src/bar.js, utf8)', templateContext.templateOptions)
    expect(template).nthCalledWith(3, 'readFile(/var/nuxt/src/baz.js, utf8)', templateContext.templateOptions)
    expect(templateFn).toBeCalledTimes(3)
    expect(templateFn).nthCalledWith(1, {
      ...templateContext.templateVars,
      custom: undefined,
      dst: 'foo.js',
      src: '/var/nuxt/src/foo.js',
      options: { foo: true }
    })
    expect(templateFn).nthCalledWith(2, {
      ...templateContext.templateVars,
      custom: undefined,
      dst: 'bar.js',
      src: '/var/nuxt/src/bar.js',
      options: { bar: true }
    })
    expect(templateFn).nthCalledWith(3, {
      ...templateContext.templateVars,
      custom: true,
      dst: 'baz.js',
      src: '/var/nuxt/src/baz.js'
    })
    expect(stripWhitespace).toBeCalledTimes(3)
    expect(stripWhitespace).nthCalledWith(1, 'compiled content')
    expect(stripWhitespace).nthCalledWith(2, 'compiled content')
    expect(stripWhitespace).nthCalledWith(3, 'compiled content')
    expect(fs.outputFile).toBeCalledTimes(3)
    expect(fs.outputFile).nthCalledWith(1, 'r(/var/nuxt/build, foo.js)', 'trim(compiled content)', 'utf8')
    expect(fs.outputFile).nthCalledWith(2, 'r(/var/nuxt/build, bar.js)', 'trim(compiled content)', 'utf8')
    expect(fs.outputFile).nthCalledWith(3, 'r(/var/nuxt/build, baz.js)', 'trim(compiled content)', 'utf8')
  })

  test('should throw error if compile failed', async () => {
    const nuxt = createNuxt()
    const builder = new Builder(nuxt, BundleBuilder)
    builder.relativeToBuild = jest.fn()
    template.mockImplementation(() => {
      throw new Error('compile failed')
    })

    const templateContext = {
      templateVars: { test: 'template_vars' },
      templateFiles: [{ src: '/var/nuxt/src/foo.js' }],
      templateOptions: {}
    }
    await expect(builder.compileTemplates(templateContext)).rejects.toThrow(
      'Could not compile template /var/nuxt/src/foo.js: compile failed'
    )
  })

  describe('builder: builder resolveLayouts', () => {
    test('should resolve layouts', async () => {
      const nuxt = createNuxt()
      nuxt.options.features = { layouts: true }
      nuxt.options.srcDir = '/var/nuxt/src'
      nuxt.options.buildDir = '/var/nuxt/build'
      nuxt.options.dir = {
        layouts: '/var/nuxt/src/layouts'
      }
      nuxt.options.layouts = {
        foo: '/var/nuxt/layouts/foo/index.vue'
      }
      const builder = new Builder(nuxt, BundleBuilder)
      builder.resolveFiles = jest.fn(layouts => [
        `${layouts}/foo.vue`,
        `${layouts}/bar.js`,
        `${layouts}/baz.vue`,
        `${layouts}/error.vue`
      ])
      builder.relativeToBuild = jest.fn((...args) => `relativeBuild(${args.join(', ')})`)
      fs.exists.mockReturnValueOnce(true)

      const templateVars = {
        components: {},
        layouts: {
          bar: '/var/nuxt/layouts/bar/index.vue'
        }
      }
      const templateFiles = []
      await builder.resolveLayouts({ templateVars, templateFiles })

      expect(path.resolve).toBeCalledTimes(1)
      expect(path.resolve).toBeCalledWith('/var/nuxt/src', '/var/nuxt/src/layouts')
      expect(fs.exists).toBeCalledTimes(1)
      expect(fs.exists).toBeCalledWith('/var/nuxt/src/layouts')
      expect(builder.resolveFiles).toBeCalledTimes(1)
      expect(builder.resolveFiles).toBeCalledWith('/var/nuxt/src/layouts')
      expect(builder.relativeToBuild).toBeCalledTimes(2)
      expect(builder.relativeToBuild).nthCalledWith(1, '/var/nuxt/src', '/var/nuxt/src/layouts/baz.vue')
      expect(builder.relativeToBuild).nthCalledWith(2, '/var/nuxt/src', '/var/nuxt/src/layouts/error.vue')
      expect(templateVars.components.ErrorPage).toEqual('relativeBuild(/var/nuxt/src, /var/nuxt/src/layouts/error.vue)')
      expect(consola.warn).toBeCalledTimes(1)
      expect(consola.warn).toBeCalledWith('Duplicate layout registration, "foo" has been registered as "/var/nuxt/layouts/foo/index.vue"')
      expect(templateVars.layouts).toEqual({
        bar: '/var/nuxt/layouts/bar/index.vue',
        baz: 'relativeBuild(/var/nuxt/src, /var/nuxt/src/layouts/baz.vue)',
        default: './layouts/default.vue'
      })
      expect(fs.mkdirp).toBeCalledTimes(1)
      expect(fs.mkdirp).toBeCalledWith('r(/var/nuxt/build, layouts)')
      expect(templateFiles).toEqual(['layouts/default.vue'])
      expect(templateVars.layouts.default).toEqual('./layouts/default.vue')
    })

    test('should resolve error layouts', async () => {
      const nuxt = createNuxt()
      nuxt.options.features = { layouts: true }
      nuxt.options.srcDir = '/var/nuxt/src'
      nuxt.options.dir = {
        layouts: '/var/nuxt/src/layouts'
      }
      const builder = new Builder(nuxt, BundleBuilder)
      builder.resolveFiles = jest.fn(layouts => [
        `${layouts}/error.vue`
      ])
      builder.relativeToBuild = jest.fn((...args) => `relativeBuild(${args.join(', ')})`)
      fs.exists.mockReturnValueOnce(true)

      const templateVars = {
        components: {
          ErrorPage: '/var/nuxt/components/error.vue'
        },
        layouts: {
          default: '/var/nuxt/layouts/default.vue'
        }
      }
      await builder.resolveLayouts({ templateVars })

      expect(builder.relativeToBuild).not.toBeCalled()
      expect(templateVars.components.ErrorPage).toEqual('/var/nuxt/components/error.vue')
    })

    test('should not resolve layouts if layouts dir does not exist', async () => {
      const nuxt = createNuxt()
      nuxt.options.features = { layouts: true }
      nuxt.options.srcDir = '/var/nuxt/src'
      nuxt.options.dir = {
        layouts: '/var/nuxt/src/layouts'
      }
      const builder = new Builder(nuxt, BundleBuilder)
      builder.resolveFiles = jest.fn()
      fs.exists.mockReturnValueOnce(false)

      const templateVars = {
        layouts: {
          default: '/var/nuxt/layouts/default.vue'
        }
      }
      await builder.resolveLayouts({ templateVars })

      expect(path.resolve).toBeCalledTimes(1)
      expect(path.resolve).toBeCalledWith('/var/nuxt/src', '/var/nuxt/src/layouts')
      expect(fs.exists).toBeCalledTimes(1)
      expect(fs.exists).toBeCalledWith('/var/nuxt/src/layouts')
      expect(builder.resolveFiles).not.toBeCalled()
      expect(fs.mkdirp).not.toBeCalled()
    })
  })

  describe('builder: builder resolveRoutes', () => {
    test('should resolve routes via build.createRoutes', async () => {
      const nuxt = createNuxt()
      nuxt.options.srcDir = '/var/nuxt/src'
      nuxt.options.build.createRoutes = jest.fn(() => [{ name: 'default_route' }])
      nuxt.options.router.extendRoutes = jest.fn(routes => [...routes, { name: 'extend_route' }])
      const builder = new Builder(nuxt, BundleBuilder)

      const templateVars = {
        router: {
          routes: []
        }
      }
      await builder.resolveRoutes({ templateVars })

      expect(consola.debug).toBeCalledTimes(1)
      expect(consola.debug).toBeCalledWith('Generating routes...')
      expect(nuxt.options.build.createRoutes).toBeCalledTimes(1)
      expect(nuxt.options.build.createRoutes).toBeCalledWith('/var/nuxt/src')
      expect(nuxt.callHook).toBeCalledTimes(1)
      expect(nuxt.callHook).toBeCalledWith(
        'build:extendRoutes',
        [{ name: 'default_route' }],
        r
      )
      expect(nuxt.options.router.extendRoutes).toBeCalledTimes(1)
      expect(nuxt.options.router.extendRoutes).toBeCalledWith([{ name: 'default_route' }], r)
      expect(templateVars.router.routes).toEqual([
        { name: 'default_route' },
        { name: 'extend_route' }
      ])
      expect(builder.routes).toEqual(templateVars.router.routes)
    })

    test('should resolve routes from default pages dir', async () => {
      const nuxt = createNuxt()
      nuxt.options.srcDir = '/var/nuxt/src'
      nuxt.options.build = {
        watch: [],
        createRoutes: jest.fn(),
        template: { dir: '/var/nuxt/templates' }
      }
      nuxt.options.router.routeNameSplitter = '[splitter]'
      createRoutes.mockReturnValueOnce([{ name: 'default_route' }])
      const builder = new Builder(nuxt, BundleBuilder)
      builder._defaultPage = true

      const templateVars = {
        router: {
          routes: []
        }
      }
      await builder.resolveRoutes({ templateVars })

      expect(consola.debug).toBeCalledTimes(1)
      expect(consola.debug).toBeCalledWith('Generating routes...')
      expect(nuxt.options.build.createRoutes).not.toBeCalled()
      expect(createRoutes).toBeCalledTimes(1)
      expect(createRoutes).toBeCalledWith({
        files: ['index.vue'],
        srcDir: '/var/nuxt/templates/pages',
        routeNameSplitter: '[splitter]'
      })
      expect(nuxt.callHook).toBeCalledTimes(1)
      expect(nuxt.callHook).toBeCalledWith(
        'build:extendRoutes',
        [{ name: 'default_route' }],
        r
      )
      expect(templateVars.router.routes).toEqual([
        { name: 'default_route' }
      ])
      expect(builder.routes).toEqual(templateVars.router.routes)
    })

    test('should resolve routes from dir.pages', async () => {
      const nuxt = createNuxt()
      nuxt.options.srcDir = '/var/nuxt/src'
      nuxt.options.dir = {
        pages: '/var/nuxt/pages'
      }
      nuxt.options.build = {
        watch: [],
        createRoutes: jest.fn()
      }
      nuxt.options.router = {
        routeNameSplitter: '[splitter]',
        extendRoutes: jest.fn()
      }
      createRoutes.mockImplementationOnce(({ files }) => files.map(file => ({ path: file })))
      const builder = new Builder(nuxt, BundleBuilder)
      builder._nuxtPages = true
      builder.resolveFiles = jest.fn(dir => [
        `${dir}/foo.js`,
        `${dir}/bar.vue`,
        `${dir}/baz.vue`,
        `${dir}/foo.vue`,
        `${dir}/bar.js`
      ])

      const templateVars = {
        router: {
          routes: []
        }
      }
      await builder.resolveRoutes({ templateVars })

      expect(consola.debug).toBeCalledTimes(1)
      expect(consola.debug).toBeCalledWith('Generating routes...')
      expect(nuxt.options.build.createRoutes).not.toBeCalled()
      expect(builder.resolveFiles).toBeCalledTimes(1)
      expect(builder.resolveFiles).toBeCalledWith('/var/nuxt/pages')

      expect(createRoutes).toBeCalledTimes(1)
      expect(createRoutes).toBeCalledWith({
        files: ['/var/nuxt/pages/foo.vue', '/var/nuxt/pages/bar.vue', '/var/nuxt/pages/baz.vue'],
        srcDir: '/var/nuxt/src',
        pagesDir: '/var/nuxt/pages',
        routeNameSplitter: '[splitter]',
        supportedExtensions: ['vue', 'js']
      })
      expect(nuxt.callHook).toBeCalledTimes(1)
      expect(nuxt.callHook).toBeCalledWith(
        'build:extendRoutes',
        [
          { path: '/var/nuxt/pages/foo.vue' },
          { path: '/var/nuxt/pages/bar.vue' },
          { path: '/var/nuxt/pages/baz.vue' }
        ],
        r
      )
      expect(templateVars.router.routes).toEqual([
        { path: '/var/nuxt/pages/foo.vue' },
        { path: '/var/nuxt/pages/bar.vue' },
        { path: '/var/nuxt/pages/baz.vue' }
      ])
      expect(builder.routes).toEqual(templateVars.router.routes)
    })
  })
})
