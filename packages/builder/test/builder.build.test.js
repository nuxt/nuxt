import path from 'path'
import consola from 'consola'
import fsExtra from 'fs-extra'
import { r, waitFor } from '@nuxt/utils'
import { BundleBuilder } from '@nuxt/webpack'

import Builder from '../src/builder'
import { createNuxt } from './__utils__'

jest.mock('fs-extra')
jest.mock('hash-sum', () => src => `hash(${src})`)
jest.mock('@nuxt/utils')
jest.mock('../src/ignore')
jest.mock('@nuxt/webpack')

jest.mock('path', () => ({
  ...jest.requireActual('path')
}))

describe('builder: builder build', () => {
  beforeAll(() => {
    jest.spyOn(path, 'join').mockImplementation((...args) => `join(${args.join(', ')})`)
    jest.spyOn(path, 'resolve').mockImplementation((...args) => `resolve(${args.join(', ')})`)
    r.mockImplementation((...args) => `r(${args.join(', ')})`)
  })

  afterAll(() => {
    path.join.mockRestore()
    path.resolve.mockRestore()
  })

  beforeEach(() => {
    jest.clearAllMocks()
  })

  test('should build all resources', async () => {
    const nuxt = createNuxt()
    nuxt.options.srcDir = '/var/nuxt/src'
    nuxt.options.buildDir = '/var/nuxt/build'
    nuxt.options.dir = { pages: '/var/nuxt/src/pages' }
    nuxt.options.build.template = { dir: '/var/nuxt/src/template' }
    nuxt.options.build.createRoutes = jest.fn()
    nuxt.options.render = { ssr: true }

    const bundleBuilder = { build: jest.fn() }
    const builder = new Builder(nuxt, bundleBuilder)
    builder.validatePages = jest.fn()
    builder.generateRoutesAndFiles = jest.fn()
    builder.resolvePlugins = jest.fn()

    const buildReturn = await builder.build()

    expect(consola.info).toBeCalledTimes(3)
    expect(consola.info).toBeCalledWith('Production build')
    expect(nuxt.ready).toBeCalledTimes(1)
    expect(nuxt.callHook).toBeCalledTimes(3)
    expect(nuxt.callHook).nthCalledWith(1, 'build:before', builder, nuxt.options.build)
    expect(nuxt.callHook).nthCalledWith(2, 'builder:prepared', builder, nuxt.options.build)
    expect(builder.validatePages).toBeCalledTimes(1)
    expect(consola.success).toBeCalledTimes(1)
    expect(consola.success).toBeCalledWith('Builder initialized')
    expect(consola.debug).toBeCalledTimes(1)
    expect(consola.debug).toBeCalledWith('App root: /var/nuxt/src')
    expect(fsExtra.emptyDir).toBeCalledTimes(4)
    expect(fsExtra.emptyDir).nthCalledWith(1, 'r(/var/nuxt/build)')
    expect(fsExtra.emptyDir).nthCalledWith(2, 'r(/var/nuxt/build, components)')
    expect(fsExtra.emptyDir).nthCalledWith(3, 'r(/var/nuxt/build, dist, client)')
    expect(fsExtra.emptyDir).nthCalledWith(4, 'r(/var/nuxt/build, dist, server)')
    expect(r).toBeCalledTimes(4)
    expect(r).nthCalledWith(1, '/var/nuxt/build')
    expect(r).nthCalledWith(2, '/var/nuxt/build', 'components')
    expect(r).nthCalledWith(3, '/var/nuxt/build', 'dist', 'client')
    expect(r).nthCalledWith(4, '/var/nuxt/build', 'dist', 'server')
    expect(builder.generateRoutesAndFiles).toBeCalledTimes(1)
    expect(nuxt.options.build.watch).toEqual(['/var/nuxt/src/template/**/*.{vue,js}'])
    expect(builder.resolvePlugins).toBeCalledTimes(1)
    expect(bundleBuilder.build).toBeCalledTimes(1)
    expect(builder._buildStatus).toEqual(2)
    expect(nuxt.callHook).nthCalledWith(3, 'build:done', builder)
    expect(buildReturn).toBe(builder)
  })

  test('should prevent duplicate build in dev mode', async () => {
    const nuxt = createNuxt()
    nuxt.options.dev = true
    const builder = new Builder(nuxt, BundleBuilder)
    builder._buildStatus = 3

    waitFor.mockImplementationOnce(() => {
      builder.build = jest.fn(() => 'calling build')
    })

    const buildReturn = await builder.build()

    expect(nuxt.ready).not.toBeCalled()
    expect(waitFor).toBeCalledTimes(1)
    expect(waitFor).toBeCalledWith(1000)
    expect(builder.build).toBeCalledTimes(1)
    expect(buildReturn).toBe('calling build')
  })

  test('should wait 1000ms and retry if building is in progress', async () => {
    const nuxt = createNuxt()
    nuxt.options.dev = true
    const builder = new Builder(nuxt, BundleBuilder)
    builder._buildStatus = 2

    const buildReturn = await builder.build()

    expect(nuxt.ready).not.toBeCalled()
    expect(buildReturn).toBe(builder)
  })

  test('should build in dev mode and print dev mode building messages', async () => {
    const nuxt = createNuxt()
    nuxt.options.dev = true
    nuxt.options.srcDir = '/var/nuxt/src'
    nuxt.options.buildDir = '/var/nuxt/build'
    nuxt.options.dir = { pages: '/var/nuxt/src/pages' }
    nuxt.options.build.createRoutes = jest.fn()
    nuxt.options.render = { ssr: true }

    const bundleBuilder = { build: jest.fn() }
    const builder = new Builder(nuxt, bundleBuilder)
    builder.validatePages = jest.fn()
    builder.generateRoutesAndFiles = jest.fn()
    builder.resolvePlugins = jest.fn()

    await builder.build()

    expect(consola.info).toBeCalledTimes(2)
    expect(consola.info).nthCalledWith(1, 'Preparing project for development')
    expect(consola.info).nthCalledWith(2, 'Initial build may take a while')
    expect(fsExtra.emptyDir).toBeCalledTimes(2)
    expect(fsExtra.emptyDir).nthCalledWith(1, 'r(/var/nuxt/build)')
    expect(fsExtra.emptyDir).nthCalledWith(2, 'r(/var/nuxt/build, components)')
    expect(r).toBeCalledTimes(2)
    expect(r).nthCalledWith(1, '/var/nuxt/build')
    expect(r).nthCalledWith(2, '/var/nuxt/build', 'components')
  })

  test('should warn built-in page will be used if no pages dir found', async () => {
    const nuxt = createNuxt()
    nuxt.options.srcDir = '/var/nuxt/src'
    nuxt.options.dir = { pages: '/var/nuxt/src/pages' }
    const builder = new Builder(nuxt, BundleBuilder)
    fsExtra.exists.mockReturnValue(false)

    await builder.validatePages()

    expect(builder._nuxtPages).toEqual(true)
    expect(path.resolve).toBeCalledTimes(1)
    expect(path.resolve).nthCalledWith(1, '/var/nuxt/src', '/var/nuxt/src/pages')
    expect(path.join).toBeCalledTimes(1)
    expect(path.join).nthCalledWith(1, '/var/nuxt/src', '..', '/var/nuxt/src/pages')
    expect(fsExtra.exists).toBeCalledTimes(2)
    expect(fsExtra.exists).nthCalledWith(1, 'resolve(/var/nuxt/src, /var/nuxt/src/pages)')
    expect(fsExtra.exists).nthCalledWith(2, 'join(/var/nuxt/src, .., /var/nuxt/src/pages)')
    expect(builder._defaultPage).toEqual(true)
    expect(consola.warn).toBeCalledTimes(1)
    expect(consola.warn).toBeCalledWith('No `/var/nuxt/src/pages` directory found in /var/nuxt/src. Using the default built-in page.')
  })

  test('should throw error if pages is found in parent dir', async () => {
    const nuxt = createNuxt()
    nuxt.options.srcDir = '/var/nuxt/src'
    nuxt.options.dir = { pages: '/var/nuxt/src/pages' }
    const builder = new Builder(nuxt, BundleBuilder)
    fsExtra.exists
      .mockReturnValueOnce(false)
      .mockReturnValueOnce(true)

    await expect(builder.validatePages()).rejects.toThrow(
      'No `/var/nuxt/src/pages` directory found in /var/nuxt/src. Did you mean to run `nuxt` in the parent (`../`) directory?'
    )

    expect(builder._nuxtPages).toEqual(true)
    expect(path.resolve).nthCalledWith(1, '/var/nuxt/src', '/var/nuxt/src/pages')
    expect(path.join).nthCalledWith(1, '/var/nuxt/src', '..', '/var/nuxt/src/pages')
    expect(fsExtra.exists).toBeCalledTimes(2)
    expect(fsExtra.exists).nthCalledWith(1, 'resolve(/var/nuxt/src, /var/nuxt/src/pages)')
    expect(fsExtra.exists).nthCalledWith(2, 'join(/var/nuxt/src, .., /var/nuxt/src/pages)')
    expect(builder._defaultPage).toBeUndefined()
  })

  test('should pass validation if createRoutes is function', async () => {
    const nuxt = createNuxt()
    nuxt.options.build.createRoutes = jest.fn()
    const builder = new Builder(nuxt, BundleBuilder)

    await builder.validatePages()

    expect(builder._nuxtPages).toEqual(false)
    expect(fsExtra.exists).not.toBeCalled()
  })

  test('should pass validation if pages exists', async () => {
    const nuxt = createNuxt()
    nuxt.options.srcDir = '/var/nuxt/src'
    nuxt.options.dir = { pages: '/var/nuxt/src/pages' }
    const builder = new Builder(nuxt, BundleBuilder)
    fsExtra.exists.mockReturnValueOnce(true)

    await builder.validatePages()

    expect(builder._nuxtPages).toEqual(true)
    expect(path.resolve).toBeCalledTimes(1)
    expect(path.resolve).toBeCalledWith('/var/nuxt/src', '/var/nuxt/src/pages')
    expect(fsExtra.exists).toBeCalledTimes(1)
    expect(fsExtra.exists).toBeCalledWith('resolve(/var/nuxt/src, /var/nuxt/src/pages)')
    expect(builder._defaultPage).toBeUndefined()
  })
})
