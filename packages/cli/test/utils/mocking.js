import Command from '../../src/common/command'

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
  const showReady = jest.fn()

  mockGetNuxt({
    rootDir: '.',
    render: {
      ssr
    }
  }, {
    listen,
    showReady
  })

  return { listen, showReady }
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
      if (type === 'watch:fileChanged') {
        Nuxt.fileChangedHook = fn
      }
    },
    clearHook: jest.fn(),
    close: jest.fn(),
    listen: jest.fn().mockImplementationOnce(() => Promise.resolve()),
    showReady: jest.fn().mockImplementationOnce(() => Promise.resolve())
  }, implementation || {})

  Command.prototype.importCore = jest.fn().mockImplementationOnce(() => {
    return { Nuxt }
  })
  return Nuxt
}

export const mockBuilder = (implementation) => {
  const Builder = function () {}
  Object.assign(Builder.prototype, {
    build: jest.fn().mockImplementationOnce(() => Promise.resolve()),
    unwatch: jest.fn().mockImplementationOnce(() => Promise.resolve()),
    watchServer: jest.fn().mockImplementationOnce(() => Promise.resolve())
  }, implementation || {})

  Command.prototype.importBuilder = jest.fn().mockImplementationOnce(() => {
    return { Builder }
  })
  return Builder
}
