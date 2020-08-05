import fs from 'fs'
import path from 'path'
import consola from 'consola'
import { chainFn } from '@nuxt/utils'
import ModuleContainer from '../src/module'

jest.mock('fs', () => ({
  existsSync: Boolean,
  closeSync: Boolean,
  realpath: jest.fn()
}))

jest.mock('hash-sum', () => src => `hash(${src})`)

jest.mock('@nuxt/utils', () => ({
  ...jest.requireActual('@nuxt/utils'),
  chainFn: jest.fn(() => 'chainedFn')
}))

const defaultOptions = {
  modules: [],
  buildModules: [],
  _modules: []
}

describe('core: module', () => {
  const requireModule = jest.fn(src => options => Promise.resolve({ src, options }))

  beforeEach(() => {
    consola.debug.mockClear()
    consola.log.mockClear()
    consola.warn.mockClear()
    consola.error.mockClear()
    consola.fatal.mockClear()
    chainFn.mockClear()
    requireModule.mockClear()
  })

  test('should construct module container', () => {
    const nuxt = jest.fn()
    nuxt.options = jest.fn()
    const module = new ModuleContainer(nuxt)

    expect(module.nuxt).toBe(nuxt)
    expect(module.options).toBe(nuxt.options)
    expect(module.requiredModules).toEqual({})
  })

  test('should call hooks and addModule when ready', async () => {
    const nuxt = {
      options: {
        ...defaultOptions,
        modules: [jest.fn(), jest.fn()]
      },
      callHook: jest.fn()
    }
    const module = new ModuleContainer(nuxt)
    module.addModule = jest.fn()

    await module.ready()

    expect(nuxt.callHook).toBeCalledTimes(2)
    expect(nuxt.callHook).nthCalledWith(1, 'modules:before', module, module.options.modules)
    expect(nuxt.callHook).nthCalledWith(2, 'modules:done', module)

    expect(module.addModule).toBeCalledTimes(2)
    expect(module.addModule).nthCalledWith(1, module.options.modules[0])
    expect(module.addModule).nthCalledWith(2, module.options.modules[1])
  })

  test('should display deprecated message for addVendor', () => {
    new ModuleContainer({
      ...defaultOptions
    }).addVendor()

    expect(consola.warn).toBeCalledTimes(1)
    expect(consola.warn).toBeCalledWith('addVendor has been deprecated due to webpack4 optimization')
  })

  test('should add string template', () => {
    const module = new ModuleContainer({
      options: {
        ...defaultOptions,
        build: {
          templates: []
        }
      }
    })

    const template = module.addTemplate('/var/nuxt/test')
    const expected = {
      dst: 'nuxt.test.hash(/var/nuxt/test)',
      options: undefined,
      src: '/var/nuxt/test'
    }
    expect(template).toEqual(expected)
    expect(module.options.build.templates).toEqual([expected])
  })

  test('should add object template', () => {
    const module = new ModuleContainer({
      options: {
        ...defaultOptions,
        build: {
          templates: []
        }
      }
    })

    const template = module.addTemplate({
      src: '/var/nuxt/test',
      options: { test: true }
    })
    const expected = {
      dst: 'nuxt.test.hash(/var/nuxt/test)',
      options: { test: true },
      src: '/var/nuxt/test'
    }
    expect(template).toEqual(expected)
    expect(module.options.build.templates).toEqual([expected])
  })

  test('should use filename in preference to calculation', () => {
    const module = new ModuleContainer({
      ...defaultOptions,
      options: {
        build: {
          templates: []
        }
      }
    })

    const template = module.addTemplate({
      src: '/var/nuxt/test',
      fileName: '/var/nuxt/dist/test'
    })
    const expected = {
      dst: '/var/nuxt/dist/test',
      options: undefined,
      src: '/var/nuxt/test'
    }
    expect(template).toEqual(expected)
    expect(module.options.build.templates).toEqual([expected])
  })

  test('should throw error when template invalid', () => {
    const module = new ModuleContainer({
      options: {
        ...defaultOptions
      }
    })

    expect(() => module.addTemplate()).toThrow('Invalid template: undefined')
  })

  test('should throw error when template not found', () => {
    const module = new ModuleContainer({
      options: {
        ...defaultOptions
      }
    })
    fs.existsSync = jest.fn(() => false)

    expect(() => module.addTemplate('/var/nuxt/test')).toThrow('Template src not found: /var/nuxt/test')

    fs.existsSync = jest.fn(Boolean)
  })

  test('should add plugin into module', () => {
    const module = new ModuleContainer({
      options: {
        ...defaultOptions,
        buildDir: '/var/nuxt/build',
        plugins: []
      }
    })
    module.addTemplate = jest.fn(() => ({ dst: 'nuxt.test.template' }))

    module.addPlugin({ ssr: false, mode: 'client' })

    expect(module.options.plugins).toEqual([{
      src: path.join('/var/nuxt/build', 'nuxt.test.template'),
      ssr: false,
      mode: 'client'
    }])
  })

  test('should add layout into module', () => {
    const module = new ModuleContainer({
      options: {
        ...defaultOptions,
        layouts: {}
      }
    })
    module.addTemplate = jest.fn(() => ({
      dst: 'nuxt.test.template',
      src: '/var/nuxt/src'
    }))

    module.addLayout({}, 'test-layout')

    expect(module.options.layouts).toEqual({ 'test-layout': './nuxt.test.template' })
  })

  test('should display deprecated message when registration is duplicate', () => {
    const module = new ModuleContainer({
      options: {
        ...defaultOptions,
        layouts: {
          'test-layout': 'test.template'
        }
      }
    })
    module.addTemplate = jest.fn(() => ({
      dst: 'nuxt.test.template',
      src: '/var/nuxt/src'
    }))

    module.addLayout({}, 'test-layout')

    expect(consola.warn).toBeCalledTimes(1)
    expect(consola.warn).toBeCalledWith('Duplicate layout registration, "test-layout" has been registered as "test.template"')
  })

  test('should register error layout at same time', () => {
    const module = new ModuleContainer({
      options: {
        ...defaultOptions,
        layouts: {}
      }
    })
    module.addErrorLayout = jest.fn()
    module.addTemplate = jest.fn(() => ({
      dst: 'nuxt.test.template',
      src: '/var/nuxt/src'
    }))

    module.addLayout({}, 'error')

    expect(module.options.layouts).toEqual({ error: './nuxt.test.template' })
    expect(module.addErrorLayout).toBeCalledTimes(1)
    expect(module.addErrorLayout).toBeCalledWith('nuxt.test.template')
  })

  test('should add error layout', () => {
    const module = new ModuleContainer({
      options: {
        ...defaultOptions,
        rootDir: '/var/nuxt',
        buildDir: '/var/nuxt/build',
        layouts: {}
      }
    })

    module.addErrorLayout('error.template')

    expect(module.options.ErrorPage).toEqual('~/build/error.template')
  })

  test('should add server middleware', () => {
    const module = new ModuleContainer({
      options: {
        ...defaultOptions,
        serverMiddleware: []
      }
    })

    module.addServerMiddleware(() => {})
    module.addServerMiddleware(() => {})

    expect(module.options.serverMiddleware).toHaveLength(2)
    expect(module.options.serverMiddleware).toEqual([expect.any(Function), expect.any(Function)])
  })

  test('should chain build.extend', () => {
    const extend = () => {}
    const module = new ModuleContainer({
      options: {
        ...defaultOptions,
        build: { extend }
      }
    })

    const newExtend = () => {}
    module.extendBuild(newExtend)

    expect(chainFn).toBeCalledTimes(1)
    expect(chainFn).toBeCalledWith(extend, newExtend)
    expect(module.options.build.extend).toEqual('chainedFn')
  })

  test('should chain router.extendRoutes', () => {
    const extendRoutes = () => {}
    const module = new ModuleContainer({
      options: {
        ...defaultOptions,
        router: { extendRoutes }
      }
    })

    const newExtendRoutes = () => {}
    module.extendRoutes(newExtendRoutes)

    expect(chainFn).toBeCalledTimes(1)
    expect(chainFn).toBeCalledWith(extendRoutes, newExtendRoutes)
    expect(module.options.router.extendRoutes).toEqual('chainedFn')
  })

  test('should call addModule when require module', () => {
    const module = new ModuleContainer({
      options: {
        ...defaultOptions
      }
    })
    module.addModule = jest.fn()

    const moduleOpts = {}
    module.requireModule(moduleOpts)

    expect(module.addModule).toBeCalledTimes(1)
    expect(module.addModule).toBeCalledWith(moduleOpts)
  })

  test('should add string module', async () => {
    const module = new ModuleContainer({
      resolver: { requireModule },
      options: {
        ...defaultOptions
      }
    })

    const result = await module.addModule('moduleTest')

    expect(requireModule).toBeCalledTimes(1)
    expect(requireModule).toBeCalledWith('moduleTest', { useESM: true })
    expect(module.requiredModules).toEqual({
      moduleTest: {
        handler: expect.any(Function),
        options: undefined,
        src: 'moduleTest'
      }
    })
    expect(result).toEqual({ src: 'moduleTest', options: {} })
  })

  test('should add function module', async () => {
    const module = new ModuleContainer({
      resolver: { requireModule },
      options: {
        ...defaultOptions
      }
    })

    const functionModule = function (options) {
      return Promise.resolve(options)
    }

    functionModule.meta = { name: 'moduleTest' }

    const result = await module.addModule(functionModule)

    expect(requireModule).not.toBeCalled()
    expect(module.requiredModules).toEqual({
      moduleTest: {
        handler: expect.any(Function),
        options: undefined,
        src: functionModule
      }
    })
    expect(result).toEqual({ })
  })

  test('should add array module', async () => {
    const module = new ModuleContainer({
      resolver: { requireModule },
      options: {
        ...defaultOptions
      }
    })

    const result = await module.addModule(['moduleTest', { test: true }])

    expect(requireModule).toBeCalledTimes(1)
    expect(requireModule).toBeCalledWith('moduleTest', { useESM: true })
    expect(module.requiredModules).toEqual({
      moduleTest: {
        handler: expect.any(Function),
        options: {
          test: true
        },
        src: 'moduleTest'
      }
    })
    expect(result).toEqual({ src: 'moduleTest', options: { test: true } })
  })

  test('should add object module', async () => {
    const module = new ModuleContainer({
      resolver: { requireModule },
      options: {
        ...defaultOptions
      }
    })

    const result = await module.addModule({
      src: 'pathToModule',
      options: { test: true },
      handler: opts => opts
    })

    expect(requireModule).not.toBeCalled()
    expect(module.requiredModules).toEqual({
      pathToModule: {
        src: 'pathToModule',
        options: { test: true },
        handler: expect.any(Function)
      }
    })
    expect(result).toEqual({ test: true })
  })

  test('should throw error when handler is not function', async () => {
    const module = new ModuleContainer({
      resolver: { requireModule: () => false },
      options: {
        ...defaultOptions
      }
    })

    await expect(module.addModule('moduleTest')).rejects.toThrow('Module should export a function: moduleTest')
  })

  test('should prevent multiple adding when requireOnce is enabled', async () => {
    const module = new ModuleContainer({
      resolver: { requireModule },
      options: {
        ...defaultOptions
      }
    })

    const handler = jest.fn(() => true)
    handler.meta = {
      name: 'moduleTest'
    }

    const first = await module.addModule({ handler }, true)
    const second = await module.addModule({ handler }, true)

    expect(first).toEqual(true)
    expect(second).toBeUndefined()
    expect(handler).toBeCalledTimes(1)
    expect(module.requiredModules.moduleTest).toBeDefined()
  })

  test('should prevent adding not installed buildModules', async () => {
    const module = new ModuleContainer({
      resolver: { requireModule },
      options: {
        ...defaultOptions,
        buildModules: ['test-build-module']
      }
    })

    requireModule.mockImplementationOnce(() => {
      const moduleNotFound = new Error(`Cannot find module 'test-build-module'`)
      moduleNotFound.code = 'MODULE_NOT_FOUND'
      throw moduleNotFound
    })

    const result = await module.addModule('test-build-module', true)

    expect(result).toBeUndefined()
    expect(consola.warn).toBeCalledWith('Module `test-build-module` not found. Please ensure `test-build-module` is in `devDependencies` and installed. HINT: During build step, for npm/yarn, `NODE_ENV=production` or `--production` should NOT be used.')
    expect(consola.warn).toBeCalledWith('Silently ignoring module as programatic usage detected.')
  })
})
