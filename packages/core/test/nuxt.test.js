import consola from 'consola'
import { defineAlias } from '@nuxt/utils'
import { getNuxtConfig } from '@nuxt/config'
import { Server } from '@nuxt/server'

import Nuxt from '../src/nuxt'
import ModuleContainer from '../src/module'
import Hookable from '../src/hookable'
import Resolver from '../src/resolver'
import { version } from '../package.json'

jest.mock('@nuxt/utils')
jest.mock('@nuxt/config', () => ({
  getNuxtConfig: jest.fn(() => ({}))
}))
jest.mock('@nuxt/server')

describe('core: nuxt', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    jest.spyOn(Nuxt.prototype, 'ready').mockImplementation(() => Promise.resolve())
  })

  afterEach(() => {
    if (Nuxt.prototype.ready.mockRestore) {
      Nuxt.prototype.ready.mockRestore()
    }
  })

  test('should construct nuxt with options', () => {
    const options = {}
    const nuxt = new Nuxt(options)

    expect(nuxt).toBeInstanceOf(Hookable)
    expect(getNuxtConfig).toBeCalledTimes(1)
    expect(getNuxtConfig).toBeCalledWith(options)

    expect(nuxt.resolver).toBeInstanceOf(Resolver)
    expect(nuxt.moduleContainer).toBeInstanceOf(ModuleContainer)
    expect(nuxt.server).toBeInstanceOf(Server)

    expect(nuxt._deprecatedHooks).toEqual({
      'render:context': 'render:routeContext',
      'showReady': 'webpack:done'
    })

    expect(defineAlias).toBeCalledTimes(2)
    expect(defineAlias).nthCalledWith(1, nuxt, nuxt.server, ['renderRoute', 'renderAndGetWindow', 'listen'])
    expect(defineAlias).nthCalledWith(2, nuxt, nuxt.resolver, ['resolveAlias', 'resolvePath'])

    expect(nuxt.renderer).toBe(nuxt.server)
    expect(nuxt.render).toBe(nuxt.server.app)
    expect(nuxt.showReady).toBeInstanceOf(Function)
    expect(nuxt.initialized).toEqual(false)

    expect(nuxt.ready).toBeCalledTimes(1)
  })

  test('should call hook webpack:done in showReady', () => {
    const nuxt = new Nuxt()
    nuxt.callHook = jest.fn()

    nuxt.showReady()

    expect(nuxt.callHook).toBeCalledTimes(1)
    expect(nuxt.callHook).toBeCalledWith('webpack:done')
  })

  test('should display fatal message if ready failed', async () => {
    const err = new Error('nuxt ready failed')
    Nuxt.prototype.ready.mockImplementation(() => Promise.reject(err))
    const nuxt = new Nuxt()

    await nuxt._ready

    expect(consola.fatal).toBeCalledTimes(1)
    expect(consola.fatal).toBeCalledWith(err)
  })

  test('should return nuxt version from package.json', () => {
    expect(Nuxt.version).toEqual(`v${version}`)
  })

  test('should return nuxt version from global.__NUXT', () => {
    global.__NUXT = {
      version: 'latest'
    }

    expect(Nuxt.version).toEqual('latest')

    delete global.__NUXT
  })

  test('should call module/server ready in nuxt.ready', async () => {
    const nuxt = new Nuxt()
    delete nuxt._ready
    Nuxt.prototype.ready.mockRestore()

    nuxt.callHook = jest.fn()
    nuxt.server = { ready: jest.fn() }
    nuxt.moduleContainer = { ready: jest.fn() }

    const result = await nuxt.ready()

    expect(result).toBe(nuxt)
    expect(nuxt.moduleContainer.ready).toBeCalledTimes(1)
    expect(nuxt.server.ready).toBeCalledTimes(1)
    expect(nuxt.initialized).toEqual(true)
    expect(nuxt.callHook).toBeCalledTimes(1)
    expect(nuxt.callHook).toBeCalledWith('ready', nuxt)
  })

  test('should ignore ready when _ready exists', async () => {
    const nuxt = new Nuxt()
    Nuxt.prototype.ready.mockRestore()
    const _ready = nuxt._ready = jest.fn()
    nuxt.server = { ready: jest.fn() }

    const result = await nuxt.ready()

    expect(result).toBe(_ready)
    expect(nuxt.server.ready).not.toBeCalled()
  })

  test('should add object hooks', async () => {
    const hooks = {}
    getNuxtConfig.mockReturnValueOnce({ hooks })
    const nuxt = new Nuxt()
    delete nuxt._ready
    Nuxt.prototype.ready.mockRestore()

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
    delete nuxt._ready
    Nuxt.prototype.ready.mockRestore()

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
    delete nuxt._ready
    Nuxt.prototype.ready.mockRestore()

    nuxt.callHook = jest.fn()
    nuxt.server = { ready: jest.fn() }
    nuxt.moduleContainer = { ready: jest.fn() }

    const result = await nuxt.ready()

    expect(result).toBe(nuxt)
    expect(nuxt.moduleContainer.ready).toBeCalledTimes(1)
    expect(nuxt.server.ready).toBeCalledTimes(1)
    expect(nuxt.initialized).toEqual(true)
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
