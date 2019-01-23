import path from 'path'
import Glob from 'glob'
import consola from 'consola'
import fsExtra from 'fs-extra'
import chokidar from 'chokidar'
import upath from 'upath'
import semver from 'semver'
import debounce from 'lodash/debounce'
import template from 'lodash/template'
import uniqBy from 'lodash/uniqBy'
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
import { createNuxt } from './__utils__'

jest.mock('glob')
jest.mock('pify', () => fn => fn)
jest.mock('fs-extra')
jest.mock('chokidar', () => ({
  watch: jest.fn().mockReturnThis(),
  on: jest.fn().mockReturnThis(),
  close: jest.fn().mockReturnThis()
}))
jest.mock('upath', () => ({
  normalizeSafe: jest.fn(src => src)
}))
jest.mock('semver')
jest.mock('hash-sum', () => src => `hash(${src})`)
jest.mock('lodash')
jest.mock('lodash/debounce', () => jest.fn(fn => fn))
jest.mock('lodash/template', () => jest.fn())
jest.mock('lodash/uniqBy', () => 'lodash/uniqBy')
jest.mock('@nuxt/utils')
jest.mock('@nuxt/webpack', () => ({
  BundleBuilder: jest.fn(function () {
    this.name = 'webpack_builder'
  })
}))
jest.mock('../src/context', () => jest.fn(function () {
  this.name = 'build_context'
}))

describe('builder: builder generate', () => {
  const templateFn = jest.fn(() => 'templateFn()')

  beforeAll(() => {
    template.mockImplementation(() => templateFn)
    r.mockImplementation((...args) => `r(${args.join(', ')})`)
    stripWhitespace.mockImplementation((...args) => `strip(${args.join(', ')})`)
    fsExtra.readFile.mockImplementation((...args) => `readFile(${args.join(', ')})`)
    fsExtra.outputFile.mockImplementation((...args) => `outputFile(${args.join(', ')})`)
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
    nuxt.options.srcDir = '/var/nuxt/src'
    nuxt.options.buildDir = '/var/nuxt/build'
    nuxt.options.extensions = ['js', 'vue']
    nuxt.options.vue = { config: { } }
    nuxt.options.dir = {
      layouts: '/var/nuxt/src/layouts',
      pages: '/var/nuxt/src/pages',
      store: '/var/nuxt/src/store',
      middleware: '/var/nuxt/src/middleware'
    }
    nuxt.options.router = { routes: [] }
    nuxt.options.layouts = { default: './layouts/test.vue' }
    nuxt.options.loadingIndicator = {}
    nuxt.options.build.template = {
      dir: '/var/nuxt/src/template',
      files: [ 'App.js', 'index.js' ]
    }
    nuxt.options.build.templates = []
    nuxt.options.build.watch = []
    nuxt.options.build.createRoutes = jest.fn()

    const builder = new Builder(nuxt, {})
    builder.normalizePlugins = jest.fn(() => ['/var/nuxt/src/plugin'])

    await builder.generateRoutesAndFiles()

    expect(consola.debug).toBeCalledTimes(2)
    expect(consola.debug).nthCalledWith(1, 'Generating nuxt files')
    expect(consola.debug).nthCalledWith(2, 'Generating routes...')
    expect(builder.normalizePlugins).toBeCalledTimes(1)
    expect(builder.plugins).toEqual(['/var/nuxt/src/plugin'])
    expect(nuxt.options.build.createRoutes).toBeCalledTimes(1)
    expect(nuxt.options.build.createRoutes).toBeCalledWith('/var/nuxt/src')
    expect(nuxt.callHook).toBeCalledTimes(2)
    expect(nuxt.callHook).nthCalledWith(1, 'build:extendRoutes', nuxt.options.router.routes, r)
    expect(nuxt.callHook).nthCalledWith(2, 'build:templates', {
      templatesFiles: [
        { custom: undefined, dst: 'App.js', src: 'r(/var/nuxt/src/template, App.js)' },
        { custom: undefined, dst: 'index.js', src: 'r(/var/nuxt/src/template, index.js)' }
      ],
      templateVars: expect.any(Object),
      resolve: r
    })

    const templateVars = nuxt.callHook.mock.calls[1][1].templateVars
    expect(nuxt.options.build.watch).toEqual(['/var/nuxt/src/template'])
    expect(fsExtra.readFile).toBeCalledTimes(2)
    expect(fsExtra.readFile).nthCalledWith(1, 'r(/var/nuxt/src/template, App.js)', 'utf8')
    expect(fsExtra.readFile).nthCalledWith(2, 'r(/var/nuxt/src/template, index.js)', 'utf8')
    expect(template).toBeCalledTimes(2)
    expect(template).nthCalledWith(1, 'readFile(r(/var/nuxt/src/template, App.js), utf8)', expect.any(Object))
    expect(template).nthCalledWith(2, 'readFile(r(/var/nuxt/src/template, index.js), utf8)', expect.any(Object))
    expect(templateFn).toBeCalledTimes(2)
    expect(templateFn).nthCalledWith(1, {
      ...templateVars,
      options: {},
      custom: undefined,
      dst: 'App.js',
      src: 'r(/var/nuxt/src/template, App.js)'
    })
    expect(templateFn).nthCalledWith(2, {
      ...templateVars,
      options: {},
      custom: undefined,
      dst: 'index.js',
      src: 'r(/var/nuxt/src/template, index.js)'
    })
    expect(stripWhitespace).toBeCalledTimes(2)
    expect(stripWhitespace).nthCalledWith(1, 'templateFn()')
    expect(stripWhitespace).nthCalledWith(2, 'templateFn()')
    expect(fsExtra.outputFile).toBeCalledTimes(2)
    expect(fsExtra.outputFile).nthCalledWith(1, 'r(/var/nuxt/build, App.js)', 'strip(templateFn())', 'utf8')
    expect(fsExtra.outputFile).nthCalledWith(2, 'r(/var/nuxt/build, index.js)', 'strip(templateFn())', 'utf8')
  })

  test('should resolve layout files', async () => {
    const nuxt = createNuxt()
    nuxt.options.srcDir = '/var/nuxt/src'
    nuxt.options.buildDir = '/var/nuxt/build'
    nuxt.options.extensions = ['js', 'vue']
    nuxt.options.vue = { config: { } }
    nuxt.options.dir = {
      layouts: '/var/nuxt/src/layouts',
      pages: '/var/nuxt/src/pages',
      store: '/var/nuxt/src/store',
      middleware: '/var/nuxt/src/middleware'
    }
    nuxt.options.router = { routes: [] }
    nuxt.options.layouts = { default: './layouts/test.vue' }
    nuxt.options.loadingIndicator = {}
    nuxt.options.build.template = {
      dir: '/var/nuxt/src/template',
      files: [ 'App.js', 'index.js' ]
    }
    nuxt.options.build.templates = []
    nuxt.options.build.watch = []
    nuxt.options.build.createRoutes = jest.fn()

    const builder = new Builder(nuxt, {})
    builder.normalizePlugins = jest.fn(() => ['/var/nuxt/src/plugin'])

    await builder.generateRoutesAndFiles()

    expect(consola.debug).toBeCalledTimes(2)
    expect(consola.debug).nthCalledWith(1, 'Generating nuxt files')
    expect(consola.debug).nthCalledWith(2, 'Generating routes...')
    expect(builder.normalizePlugins).toBeCalledTimes(1)
    expect(builder.plugins).toEqual(['/var/nuxt/src/plugin'])
    expect(nuxt.options.build.createRoutes).toBeCalledTimes(1)
    expect(nuxt.options.build.createRoutes).toBeCalledWith('/var/nuxt/src')
    expect(nuxt.callHook).toBeCalledTimes(2)
    expect(nuxt.callHook).nthCalledWith(1, 'build:extendRoutes', nuxt.options.router.routes, r)
    expect(nuxt.callHook).nthCalledWith(2, 'build:templates', {
      templatesFiles: [
        { custom: undefined, dst: 'App.js', src: 'r(/var/nuxt/src/template, App.js)' },
        { custom: undefined, dst: 'index.js', src: 'r(/var/nuxt/src/template, index.js)' }
      ],
      templateVars: expect.any(Object),
      resolve: r
    })

    const templateVars = nuxt.callHook.mock.calls[1][1].templateVars
    expect(nuxt.options.build.watch).toEqual(['/var/nuxt/src/template'])
    expect(fsExtra.readFile).toBeCalledTimes(2)
    expect(fsExtra.readFile).nthCalledWith(1, 'r(/var/nuxt/src/template, App.js)', 'utf8')
    expect(fsExtra.readFile).nthCalledWith(2, 'r(/var/nuxt/src/template, index.js)', 'utf8')
    expect(template).toBeCalledTimes(2)
    expect(template).nthCalledWith(1, 'readFile(r(/var/nuxt/src/template, App.js), utf8)', expect.any(Object))
    expect(template).nthCalledWith(2, 'readFile(r(/var/nuxt/src/template, index.js), utf8)', expect.any(Object))
    expect(templateFn).toBeCalledTimes(2)
    expect(templateFn).nthCalledWith(1, {
      ...templateVars,
      options: {},
      custom: undefined,
      dst: 'App.js',
      src: 'r(/var/nuxt/src/template, App.js)'
    })
    expect(templateFn).nthCalledWith(2, {
      ...templateVars,
      options: {},
      custom: undefined,
      dst: 'index.js',
      src: 'r(/var/nuxt/src/template, index.js)'
    })
    expect(stripWhitespace).toBeCalledTimes(2)
    expect(stripWhitespace).nthCalledWith(1, 'templateFn()')
    expect(stripWhitespace).nthCalledWith(2, 'templateFn()')
    expect(fsExtra.outputFile).toBeCalledTimes(2)
    expect(fsExtra.outputFile).nthCalledWith(1, 'r(/var/nuxt/build, App.js)', 'strip(templateFn())', 'utf8')
    expect(fsExtra.outputFile).nthCalledWith(2, 'r(/var/nuxt/build, index.js)', 'strip(templateFn())', 'utf8')

    // const templateOptions = template.mock.calls[0][1]._
  })

  // test('should match templateVars snapshot', async () => {
  //   const nuxt = createNuxt()
  //   nuxt.options.dev = false
  //   nuxt.options.test = true
  //   nuxt.options.debug = false
  //   nuxt.options.mode = 'test'
  //   nuxt.options.env = 'env'
  //   nuxt.options.head = 'head()'
  //   nuxt.options.store = { test: 'store' }
  //   nuxt.options.globalName = { test: 'globalName' }
  //   nuxt.options.globals = { id: 'test' }
  //   nuxt.options.css = [ 'test-css' ]
  //   nuxt.options.ignorePrefix = 'test-ignore-prefix'
  //   nuxt.options.loading = 'test-loading'
  //   nuxt.options.transition = 'test-transition'
  //   nuxt.options.layoutTransition = 'test-layout-transition'
  //   nuxt.options.ErrorPage = 'test-error-page'
  //   nuxt.options.srcDir = '/var/nuxt/src'
  //   nuxt.options.buildDir = '/var/nuxt/build'
  //   nuxt.options.extensions = ['js', 'vue', '.ts']
  //   nuxt.options.messages = { msg: 'test' }
  //   nuxt.options.vue = { config: { id: 'test' } }
  //   nuxt.options.dir = {
  //     layouts: '/var/nuxt/src/layouts',
  //     pages: '/var/nuxt/src/pages',
  //     store: '/var/nuxt/src/store',
  //     middleware: '/var/nuxt/src/middleware'
  //   }
  //   nuxt.options.router = { routes: [] }
  //   nuxt.options.layouts = { default: './layouts/test.vue' }
  //   nuxt.options.loadingIndicator = {}
  //   nuxt.options.build.template = {
  //     dir: '/var/nuxt/src/template',
  //     files: [ 'App.js', 'index.js' ]
  //   }
  //   nuxt.options.build.splitChunks = {
  //     chunks: 'all'
  //   }
  //   nuxt.options.build.templates = []
  //   nuxt.options.build.watch = []
  //   nuxt.options.build.createRoutes = jest.fn()

  //   fsExtra.existsSync.mockImplementationOnce(src => `existsSync(${src})`)

  //   const builder = new Builder(nuxt, {})

  //   builder.normalizePlugins = jest.fn(() => ['/var/nuxt/src/plugin'])
  //   builder.relativeToBuild = jest.fn(src => `relativeToBuild(${src})`)

  //   await builder.generateRoutesAndFiles()

  //   const templateVars = nuxt.callHook.mock.calls[1][1].templateVars
  //   expect(templateVars).toMatchSnapshot()
  // })
})
