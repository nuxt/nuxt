import path from 'path'
import Glob from 'glob'
import fs from 'fs-extra'
import consola from 'consola'
import { r, createRoutes } from '@nuxt/utils'
import Builder from '../src/builder'
import TemplateContext from '../src/context/template'
import { createNuxt } from './__utils__'

jest.mock('glob')
jest.mock('pify', () => fn => fn)
jest.mock('fs-extra')
jest.mock('@nuxt/utils')
jest.mock('../src/context/template', () => jest.fn())
jest.mock('../src/ignore', () => function () {
  this.filter = jest.fn(files => files)
})

describe('builder: builder generate', () => {
  beforeAll(() => {
    r.mockImplementation((...args) => `r(${args.join(', ')})`)
    fs.readFile.mockImplementation((...args) => `readFile(${args.join(', ')})`)
    fs.outputFile.mockImplementation((...args) => `outputFile(${args.join(', ')})`)
    jest.spyOn(path, 'join').mockImplementation((...args) => `join(${args.join(', ')})`)
    jest.spyOn(path, 'resolve').mockImplementation((...args) => `resolve(${args.join(', ')})`)
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
        files: [ 'App.js', 'index.js' ]
      },
      watch: []
    }
    const builder = new Builder(nuxt, {})
    builder.normalizePlugins = jest.fn(() => [{ name: 'test_plugin' }])
    builder.resolveLayouts = jest.fn(() => 'resolveLayouts')
    builder.resolveRoutes = jest.fn(() => 'resolveRoutes')
    builder.resolveStore = jest.fn(() => 'resolveStore')
    builder.resolveMiddleware = jest.fn(() => 'resolveMiddleware')
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
    expect(builder.resolveCustomTemplates).toBeCalledTimes(1)
    expect(builder.resolveLoadingIndicator).toBeCalledTimes(1)
    expect(builder.options.build.watch).toEqual(['/var/nuxt/src/template'])
    expect(builder.compileTemplates).toBeCalledTimes(1)
    expect(consola.success).toBeCalledTimes(1)
    expect(consola.success).toBeCalledWith('Nuxt files generated')

    Promise.all.mockRestore()
  })

  test('should resolve files', async () => {
    const nuxt = createNuxt()
    nuxt.options.srcDir = '/var/nuxt/src'
    nuxt.options.ignore = '/var/nuxt/ignore'
    const builder = new Builder(nuxt, {})
    Glob.mockReturnValue('matched files')

    const files = await builder.resolveFiles('/var/nuxt/dir')

    expect(Glob).toBeCalledTimes(1)
    expect(Glob).toBeCalledWith(
      '/var/nuxt/dir/**/*.{vue,js,ts,tsx}',
      { cwd: '/var/nuxt/src', ignore: '/var/nuxt/ignore' }
    )
    expect(builder.ignore.filter).toBeCalledTimes(1)
    expect(builder.ignore.filter).toBeCalledWith('matched files')
    expect(files).toEqual('matched files')
  })

  test('should resolve relative files', async () => {
    const nuxt = createNuxt()
    const builder = new Builder(nuxt, {})
    builder.resolveFiles = jest.fn(dir => [ `${dir}/foo.vue`, `${dir}/bar.vue`, `${dir}/baz.vue` ])

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
    nuxt.options.store = true
    nuxt.options.dir = {
      store: '/var/nuxt/src/store'
    }
    const builder = new Builder(nuxt, {})
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
      { 'src': '/var/nuxt/src/store/index.js' },
      { 'src': '/var/nuxt/src/store/bar.js' },
      { 'src': '/var/nuxt/src/store/baz.js' },
      { 'src': '/var/nuxt/src/store/foo/index.js' },
      { 'src': '/var/nuxt/src/store/foo/bar.js' },
      { 'src': '/var/nuxt/src/store/foo/baz.js' }]
    )
    expect(templateFiles).toEqual(['store.js'])
  })

  test('should disable store resolving', async () => {
    const nuxt = createNuxt()
    nuxt.options.dir = {
      store: '/var/nuxt/src/store'
    }
    const builder = new Builder(nuxt, {})

    const templateVars = {}
    const templateFiles = []
    await builder.resolveStore({ templateVars, templateFiles })

    expect(templateVars.storeModules).toBeUndefined()
    expect(templateFiles).toEqual([])
  })

  test('should resolve middleware', async () => {
    const nuxt = createNuxt()
    nuxt.options.store = false
    nuxt.options.dir = {
      middleware: '/var/nuxt/src/middleware'
    }
    const builder = new Builder(nuxt, {})
    builder.resolveRelative = jest.fn(dir => [
      { src: `${dir}/midd.js` }
    ])

    const templateVars = {}
    await builder.resolveMiddleware({ templateVars })

    expect(templateVars.middleware).toEqual([ { src: '/var/nuxt/src/middleware/midd.js' } ])
  })

  describe('builder: builder resolveLayouts', () => {
    test('should resolve layouts', async () => {
      const nuxt = createNuxt()
      nuxt.options.srcDir = '/var/nuxt/src'
      nuxt.options.buildDir = '/var/nuxt/build'
      nuxt.options.dir = {
        layouts: '/var/nuxt/src/layouts'
      }
      nuxt.options.layouts = {
        foo: '/var/nuxt/layouts/foo/index.vue'
      }
      const builder = new Builder(nuxt, {})
      builder.resolveFiles = jest.fn(layouts => [
        `${layouts}/foo.vue`,
        `${layouts}/bar.js`,
        `${layouts}/baz.vue`,
        `${layouts}/error.vue`
      ])
      builder.relativeToBuild = jest.fn((...args) => `relativeBuild(${args.join(', ')})`)
      fs.existsSync.mockReturnValueOnce(true)

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
      expect(fs.existsSync).toBeCalledTimes(1)
      expect(fs.existsSync).toBeCalledWith('resolve(/var/nuxt/src, /var/nuxt/src/layouts)')
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
      nuxt.options.srcDir = '/var/nuxt/src'
      nuxt.options.dir = {
        layouts: '/var/nuxt/src/layouts'
      }
      const builder = new Builder(nuxt, {})
      builder.resolveFiles = jest.fn(layouts => [
        `${layouts}/error.vue`
      ])
      builder.relativeToBuild = jest.fn((...args) => `relativeBuild(${args.join(', ')})`)
      fs.existsSync.mockReturnValueOnce(true)

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
      nuxt.options.srcDir = '/var/nuxt/src'
      nuxt.options.dir = {
        layouts: '/var/nuxt/src/layouts'
      }
      const builder = new Builder(nuxt, {})

      const templateVars = {
        layouts: {
          default: '/var/nuxt/layouts/default.vue'
        }
      }
      await builder.resolveLayouts({ templateVars })
      builder.resolveFiles = jest.fn()

      expect(path.resolve).toBeCalledTimes(1)
      expect(path.resolve).toBeCalledWith('/var/nuxt/src', '/var/nuxt/src/layouts')
      expect(fs.existsSync).toBeCalledTimes(1)
      expect(fs.existsSync).toBeCalledWith('resolve(/var/nuxt/src, /var/nuxt/src/layouts)')
      expect(builder.resolveFiles).not.toBeCalled()
      expect(fs.mkdirp).not.toBeCalled()
    })
  })

  describe('builder: builder resolveRoutes', () => {
    test('should resolve routes via build.createRoutes', async () => {
      const nuxt = createNuxt()
      nuxt.options.srcDir = '/var/nuxt/src'
      nuxt.options.build.createRoutes = jest.fn(() => [ { name: 'default_route' } ])
      nuxt.options.router.extendRoutes = jest.fn(routes => [ ...routes, { name: 'extend_route' } ])
      const builder = new Builder(nuxt, {})

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
        [ { name: 'default_route' } ],
        r
      )
      expect(nuxt.options.router.extendRoutes).toBeCalledTimes(1)
      expect(nuxt.options.router.extendRoutes).toBeCalledWith([ { name: 'default_route' } ], r)
      expect(templateVars.router.routes).toEqual([
        { name: 'default_route' },
        { name: 'extend_route' }
      ])
      expect(builder.routes).toEqual(templateVars.router.routes)
    })

    test('should resolve routes from defualt pages dir', async () => {
      const nuxt = createNuxt()
      nuxt.options.srcDir = '/var/nuxt/src'
      nuxt.options.build = {
        createRoutes: jest.fn(),
        template: { dir: '/var/nuxt/templates' }
      }
      nuxt.options.router.routeNameSplitter = '[splitter]'
      createRoutes.mockReturnValueOnce([ { name: 'default_route' } ])
      const builder = new Builder(nuxt, {})
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
      expect(createRoutes).toBeCalledWith([ 'index.vue' ], '/var/nuxt/templates/pages', '', '[splitter]')
      expect(nuxt.callHook).toBeCalledTimes(1)
      expect(nuxt.callHook).toBeCalledWith(
        'build:extendRoutes',
        [ { name: 'default_route' } ],
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
        createRoutes: jest.fn()
      }
      nuxt.options.router = {
        routeNameSplitter: '[splitter]',
        extendRoutes: jest.fn()
      }
      createRoutes.mockImplementationOnce(files => files.map(file => ({ path: file })))
      const builder = new Builder(nuxt, {})
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
      expect(createRoutes).toBeCalledWith(
        [ '/var/nuxt/pages/foo.vue', '/var/nuxt/pages/bar.vue', '/var/nuxt/pages/baz.vue' ],
        '/var/nuxt/src',
        '/var/nuxt/pages',
        '[splitter]'
      )
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
