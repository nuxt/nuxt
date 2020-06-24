import { defineAlias } from '@nuxt/utils'
import { getNuxtConfig } from '@nuxt/config'
import { Server } from '@nuxt/server'
import Hookable from 'hable'

import Nuxt from '../src/nuxt'
import ModuleContainer from '../src/module'
import Resolver from '../src/resolver'
import { version } from '../package.json'

jest.mock('@nuxt/utils')

jest.mock('@nuxt/server')

jest.mock('@nuxt/config', () => ({
  getNuxtConfig: jest.fn(() => ({
    _ready: false
  }))
}))

describe('core: nuxt', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  test('should construct nuxt with options', async () => {
    const options = {}
    const nuxt = new Nuxt(options)
    await nuxt.ready()

    expect(nuxt).toBeInstanceOf(Hookable)
    expect(getNuxtConfig).toBeCalledTimes(1)
    expect(getNuxtConfig).toBeCalledWith(options)

    expect(nuxt.resolver).toBeInstanceOf(Resolver)
    expect(nuxt.moduleContainer).toBeInstanceOf(ModuleContainer)
    expect(nuxt.server).toBeInstanceOf(Server)

    expect(defineAlias).toBeCalledTimes(2)
    expect(defineAlias).nthCalledWith(1, nuxt, nuxt.resolver, ['resolveAlias', 'resolvePath'])
    expect(defineAlias).nthCalledWith(2, nuxt, nuxt.server, ['renderRoute', 'renderAndGetWindow', 'listen'])

    expect(nuxt.renderer).toBe(nuxt.server)
    expect(nuxt.render).toBe(nuxt.server.app)
    expect(nuxt.showReady).toBeInstanceOf(Function)

    expect(nuxt._ready).toBeInstanceOf(Promise)
  })

  // TODO: Remove in next major release
  test('should call hook webpack:done in showReady', () => {
    const nuxt = new Nuxt()
    nuxt.callHook = jest.fn()

    nuxt.showReady()

    expect(nuxt.callHook).toBeCalledTimes(1)
    expect(nuxt.callHook).toBeCalledWith('webpack:done')
  })

  for (const name of ['render:context', 'render:routeContext']) {
    test('should deprecate ' + name, async () => {
      const nuxt = new Nuxt()
      const fn = jest.fn()
      nuxt.hook(name, fn)
      await nuxt.callHook('_render:context')
      expect(fn).toBeCalledTimes(1)
      expect(fn).toBeCalledWith()
    })
  }

  test('should display fatal message if ready failed', async () => {
    const err = new Error('nuxt ready failed')
    const nuxt = new Nuxt()
    nuxt._init = () => Promise.reject(err)
    await expect(nuxt.ready()).rejects.toThrow(err)
  })

  test('should return nuxt version from package.json', () => {
    expect(Nuxt.version).toEqual(`v${version}`)
  })

  test('should call module/server ready in nuxt.ready', async () => {
    const nuxt = new Nuxt()

    nuxt.callHook = jest.fn()
    nuxt.server = { ready: jest.fn() }
    nuxt.moduleContainer = { ready: jest.fn() }

    const result = await nuxt.ready()

    expect(result).toBe(nuxt)
    expect(nuxt.moduleContainer.ready).toBeCalledTimes(1)
    expect(nuxt.server.ready).toBeCalledTimes(1)
    expect(nuxt._initCalled).toEqual(true)
    expect(nuxt.callHook).toBeCalledTimes(1)
    expect(nuxt.callHook).toBeCalledWith('ready', nuxt)
  })

  test('should ignore ready when _ready exists', async () => {
    const nuxt = new Nuxt()
    const _ready = nuxt._ready = jest.fn()
    const result = await nuxt.ready()
    expect(result).toBe(_ready)
  })

  test('should add object hooks', async () => {
    const hooks = {}
    getNuxtConfig.mockReturnValueOnce({ hooks, _ready: false })
    const nuxt = new Nuxt()

    nuxt.addHooks = jest.fn()
    nuxt.server = { ready: jest.fn() }
    nuxt.moduleContainer = { ready: jest.fn() }

    await nuxt.ready()

    expect(nuxt.addHooks).toBeCalledTimes(1)
    expect(nuxt.addHooks).toBeCalledWith(hooks)
  })

  test('should add function hooks', async () => {
    const hooks = jest.fn()
    getNuxtConfig.mockReturnValueOnce({ hooks })
    const nuxt = new Nuxt()

    nuxt.addHooks = jest.fn()
    nuxt.server = { ready: jest.fn() }
    nuxt.moduleContainer = { ready: jest.fn() }

    await nuxt.ready()

    expect(nuxt.addHooks).not.toBeCalled()
    expect(hooks).toBeCalledTimes(1)
  })

  test('should close nuxt with hook triggered', async () => {
    const nuxt = new Nuxt()
    nuxt.callHook = jest.fn()
    nuxt.clearHooks = jest.fn()

    const cb = jest.fn()
    await nuxt.close(cb)

    expect(cb).toBeCalledTimes(1)
    expect(nuxt.callHook).toBeCalledTimes(1)
    expect(nuxt.callHook).toBeCalledWith('close', nuxt)
    expect(nuxt.clearHooks).toBeCalledTimes(1)
  })

  test('should ignore non-function callback in close', async () => {
    const nuxt = new Nuxt()

    nuxt.callHook = jest.fn()
    nuxt.server = { ready: jest.fn() }
    nuxt.moduleContainer = { ready: jest.fn() }

    const result = await nuxt.ready()

    expect(result).toBe(nuxt)
    expect(nuxt.moduleContainer.ready).toBeCalledTimes(1)
    expect(nuxt.server.ready).toBeCalledTimes(1)
    expect(nuxt._initCalled).toEqual(true)
    expect(nuxt.callHook).toBeCalledTimes(1)
    expect(nuxt.callHook).toBeCalledWith('ready', nuxt)
  })

  test('should ignore non-function callback in close', async () => {
    const nuxt = new Nuxt()
    nuxt.callHook = jest.fn()
    nuxt.clearHooks = jest.fn()

    const cb = {}
    await nuxt.close(cb)

    expect(nuxt.callHook).toBeCalledTimes(1)
    expect(nuxt.clearHooks).toBeCalledTimes(1)
  })
})
