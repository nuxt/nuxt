import consola from 'consola'
import { relativeTo, determineGlobals } from '@nuxt/utils'

import Builder from '../src/builder'
import { createNuxt } from './__utils__'

jest.mock('@nuxt/utils')
jest.mock('../src/ignore')

describe('builder: builder constructor', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  test('should construct builder', () => {
    const nuxt = createNuxt()

    const bundleBuilder = {}
    determineGlobals.mockReturnValueOnce('__global')

    const builder = new Builder(nuxt, bundleBuilder)

    expect(builder.nuxt).toEqual(nuxt)
    expect(builder.plugins).toEqual([])
    expect(builder.options).toEqual(nuxt.options)

    expect(determineGlobals).toBeCalledTimes(1)
    expect(determineGlobals).toBeCalledWith(nuxt.options.globalName, nuxt.options.globals)

    expect(builder.watchers).toEqual({
      files: null,
      custom: null,
      restart: null
    })
    expect(builder.supportedExtensions).toEqual(['vue', 'js'])
    expect(builder.relativeToBuild).toBeInstanceOf(Function)

    expect(builder._buildStatus).toEqual(1)

    expect(nuxt.resolver.requireModule).toBeCalledTimes(1)
    expect(nuxt.resolver.requireModule).toBeCalledWith('@nuxt/vue-app')
    expect(builder.template).toEqual('builder-template')

    expect(builder.bundleBuilder).toBe(bundleBuilder)
  })

  test('should call relativeTo in relativeToBuild', () => {
    const nuxt = createNuxt()
    nuxt.options.buildDir = '/var/nuxt/build'
    const bundleBuilder = {}
    const builder = new Builder(nuxt, bundleBuilder)

    const args = [{}, {}]
    builder.relativeToBuild(...args)

    expect(relativeTo).toBeCalledTimes(1)
    expect(relativeTo).toBeCalledWith('/var/nuxt/build', ...args)
  })

  test('should add hooks in dev mode', () => {
    const nuxt = createNuxt()
    nuxt.options.dev = true

    const bundleBuilder = {}
    determineGlobals.mockReturnValueOnce('__global')

    const builder = new Builder(nuxt, bundleBuilder)

    expect(builder.options.dev).toEqual(true)

    expect(nuxt.hook).toBeCalledTimes(2)
    expect(nuxt.hook).toBeCalledWith('build:done', expect.any(Function))
    expect(nuxt.hook).toBeCalledWith('close', expect.any(Function))

    const doneHook = nuxt.hook.mock.calls[0][1]
    builder.watchClient = jest.fn()
    builder.watchRestart = jest.fn()
    doneHook()
    expect(consola.info).toBeCalledTimes(1)
    expect(consola.info).toBeCalledWith('Waiting for file changes')
    expect(builder.watchClient).toBeCalledTimes(1)
    expect(builder.watchRestart).toBeCalledTimes(1)

    const closeHook = nuxt.hook.mock.calls[1][1]
    builder.close = jest.fn()
    closeHook()
    expect(builder.close).toBeCalledTimes(1)
  })

  test('should add hooks in analyze mode', () => {
    const nuxt = createNuxt()
    nuxt.options.build.analyze = true

    const bundleBuilder = {}
    const builder = new Builder(nuxt, bundleBuilder)

    expect(builder.options.build.analyze).toEqual(true)

    expect(nuxt.hook).toBeCalledTimes(1)
    expect(nuxt.hook).toBeCalledWith('build:done', expect.any(Function))

    const doneHook = nuxt.hook.mock.calls[0][1]
    doneHook()
    expect(consola.warn).toBeCalledTimes(1)
    expect(consola.warn).toBeCalledWith('Notice: Please do not deploy bundles built with "analyze" mode, they\'re for analysis purposes only.')
  })

  test('should support function template', () => {
    const nuxt = createNuxt()
    nuxt.options.build.template = jest.fn()
    const bundleBuilder = {}
    const builder = new Builder(nuxt, bundleBuilder)

    expect(builder.template).toBe(nuxt.options.build.template)
    expect(nuxt.resolver.requireModule).not.toBeCalled()
  })
})
