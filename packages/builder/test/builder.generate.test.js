import path from 'path'
import consola from 'consola'
import fsExtra from 'fs-extra'
import template from 'lodash/template'
import {
  r,
  stripWhitespace
} from '@nuxt/utils'

import Builder from '../src/builder'
import { createNuxt } from './__utils__'

jest.mock('fs-extra')
jest.mock('lodash/template', () => jest.fn())
jest.mock('@nuxt/utils')
jest.mock('../src/ignore', () => jest.fn(() => ({
  filter: files => files
})))

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
  })
})
