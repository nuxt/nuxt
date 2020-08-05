import path from 'path'
import consola from 'consola'
import fsExtra from 'fs-extra'
import htmlMinifier from 'html-minifier'

import Generator from '../src/generator'
import { createNuxt, hookCalls } from './__utils__'

jest.mock('path')
jest.mock('fs-extra')
jest.mock('html-minifier')
jest.mock('@nuxt/utils')

describe('generator: generate route', () => {
  const sep = path.sep

  beforeAll(() => {
    path.sep = '[sep]'
    path.join.mockImplementation((...args) => `join(${args.join(', ')})`)
    path.dirname.mockImplementation((...args) => `dirname(${args.join(', ')})`)
  })

  afterAll(() => {
    path.sep = sep
  })

  beforeEach(() => {
    jest.clearAllMocks()
  })

  test('should generate route', async () => {
    const nuxt = createNuxt()
    nuxt.options.build.html = { minify: false }
    nuxt.options.generate.minify = undefined
    nuxt.options.generate.subFolders = false
    const generator = new Generator(nuxt)
    path.join.mockClear()

    const route = '/foo/'
    const payload = {}
    const errors = []

    const returned = await generator.generateRoute({ route, payload, errors })

    expect(nuxt.server.renderRoute).toBeCalledTimes(1)
    expect(nuxt.server.renderRoute).toBeCalledWith(route, { payload })
    expect(path.join).toBeCalledTimes(2)
    expect(path.join).nthCalledWith(1, '[sep]', '/foo.html')
    expect(path.join).nthCalledWith(2, generator.distPath, 'join([sep], /foo.html)')

    expect(hookCalls(nuxt, 'generate:page')[0][0]).toMatchObject({
      route,
      html: 'rendered html',
      path: `join(${generator.distPath}, join([sep], /foo.html))`
    })

    expect(hookCalls(nuxt, 'generate:routeCreated')[0][0]).toMatchObject({
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
    generator._formatErrors = jest.fn(() => 'formatted errors')

    const route = '/foo'
    const payload = {}
    const errors = []

    const returned = await generator.generateRoute({ route, payload, errors })

    expect(nuxt.server.renderRoute).toBeCalledTimes(1)
    expect(nuxt.server.renderRoute).toBeCalledWith('/foo', { payload })
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
    expect(consola.error).toBeCalledWith('Error generating route "/foo": render route failed')
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

  test('should generate file in flat folder if route is empty', async () => {
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
