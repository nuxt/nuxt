import * as imports from '../../src/imports'
import Command from '../../src/command'

jest.mock('../../src/imports', () => {
  return {
    core: jest.fn().mockImplementation(() => ({
      Nuxt: function () {}
    })),
    builder: jest.fn().mockImplementation(() => ({
      Builder: function () {}
    })),
    generator: jest.fn().mockImplementation(() => ({
      Generator: function () {}
    })),
    webpack: jest.fn().mockImplementation(() => ({
      BundleBuilder: function () {}
    }))
  }
})

export const mockGetNuxt = (options, implementation) => {
  Command.prototype.getNuxt = jest.fn().mockImplementationOnce(() => {
    return Object.assign({
      hook: jest.fn(),
      options
    }, implementation || {})
  })
}

export const mockGetBuilder = (ret) => {
  const build = jest.fn().mockImplementationOnce(() => {
    return ret
  })

  Command.prototype.getBuilder = jest.fn().mockImplementationOnce(() => {
    return { build }
  })

  return build
}

export const mockGetGenerator = (ret) => {
  const generate = jest.fn()
  if (ret) {
    generate.mockImplementationOnce(() => {
      return ret
    })
  }

  Command.prototype.getGenerator = jest.fn().mockImplementationOnce(() => {
    return { generate }
  })

  return generate
}

export const mockGetNuxtStart = (ssr) => {
  const listen = jest.fn().mockImplementationOnce(() => {
    return Promise.resolve()
  })

  mockGetNuxt({
    rootDir: '.',
    render: {
      ssr
    }
  }, {
    server: {
      listen,
      listeners: []
    }
  })

  return { listen }
}

export const mockGetNuxtConfig = () => {
  const spy = jest.fn()
  Command.prototype.getNuxtConfig = spy
  return spy
}

export const mockNuxt = (implementation) => {
  const Nuxt = function () {}
  Object.assign(Nuxt.prototype, {
    hook(type, fn) {
      if (type === 'watch:restart') {
        Nuxt.fileRestartHook = fn
      }
    },
    options: {},
    clearHook: jest.fn(),
    clearHooks: jest.fn(),
    close: jest.fn(),
    ready: jest.fn(),
    server: {
      listeners: [],
      listen: jest.fn().mockImplementationOnce(() => Promise.resolve())
    }
  }, implementation || {})

  imports.core.mockImplementation(() => ({ Nuxt }))

  return Nuxt
}

export const mockBuilder = (implementation) => {
  const Builder = function () {}
  Object.assign(Builder.prototype, {
    build: jest.fn().mockImplementationOnce(() => Promise.resolve()),
    unwatch: jest.fn().mockImplementationOnce(() => Promise.resolve()),
    watchRestart: jest.fn().mockImplementationOnce(() => Promise.resolve())
  }, implementation || {})

  imports.builder.mockImplementation(() => ({ Builder }))

  return Builder
}
