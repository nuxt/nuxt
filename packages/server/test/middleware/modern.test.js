import consola from 'consola'

jest.mock('chalk', () => ({
  green: {
    bold: modern => `greenBold(${modern})`
  }
}))

const createContext = () => ({
  resources: {},
  options: {
    render: {}
  }
})

const createServerContext = () => ({
  req: { headers: {} },
  next: jest.fn()
})

describe('server: modernMiddleware', () => {
  let createModernMiddleware

  beforeEach(() => {
    jest.isolateModules(() => {
      createModernMiddleware = require('../../src/middleware/modern').default
    })
    jest.clearAllMocks()
  })

  test('should return modern middleware', () => {
    const modernMiddleware = createModernMiddleware({})
    expect(modernMiddleware).toBeInstanceOf(Function)
  })

  test('should not detect modern build if modern mode is specified', () => {
    const context = createContext()
    const modernMiddleware = createModernMiddleware({ context })
    const ctx = createServerContext()

    context.options.modern = false
    modernMiddleware(ctx.req, ctx.res, ctx.next)
    context.options.modern = 'client'
    modernMiddleware(ctx.req, ctx.res, ctx.next)
    context.options.modern = 'server'
    modernMiddleware(ctx.req, ctx.res, ctx.next)

    expect(ctx.req.modernMode).toEqual(false)
  })

  test('should detect client modern build and display message', () => {
    const context = createContext()
    const modernMiddleware = createModernMiddleware({ context })
    const ctx = createServerContext()

    context.resources.modernManifest = {}
    modernMiddleware(ctx.req, ctx.res, ctx.next)
    expect(context.options.modern).toEqual('client')
    expect(consola.info).toBeCalledWith('Modern bundles are detected. Modern mode (greenBold(client)) is enabled now.')
  })

  test('should detect server modern build and display message', () => {
    const context = createContext()
    const modernMiddleware = createModernMiddleware({ context })
    const ctx = createServerContext()

    context.options.render.ssr = true
    context.resources.modernManifest = {}
    modernMiddleware(ctx.req, ctx.res, ctx.next)
    expect(context.options.modern).toEqual('server')
    expect(consola.info).toBeCalledWith('Modern bundles are detected. Modern mode (greenBold(server)) is enabled now.')
  })

  test('should not detect modern browser if modern build is not found', () => {
    const context = createContext()
    const modernMiddleware = createModernMiddleware({ context })
    const ctx = createServerContext()

    modernMiddleware(ctx.req, ctx.res, ctx.next)

    expect(ctx.req.modernMode).toBeUndefined()
  })

  test('should not detect modern browser if connect has been detected', () => {
    const context = createContext()
    const modernMiddleware = createModernMiddleware({ context })
    const ctx = createServerContext()
    ctx.req.socket = { isModernBrowser: true }

    context.options.dev = true
    context.options.modern = 'server'
    modernMiddleware(ctx.req, ctx.res, ctx.next)

    expect(ctx.req.modernMode).toEqual(true)
  })

  test('should detect modern browser based on user-agent', () => {
    const context = createContext()
    const modernMiddleware = createModernMiddleware({ context })
    const ctx = createServerContext()
    const ua = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/70.0.3538.77 Safari/537.36'
    ctx.req.headers['user-agent'] = ua
    ctx.req.socket = {}

    context.options.dev = true
    context.options.modern = 'server'
    modernMiddleware(ctx.req, ctx.res, ctx.next)

    expect(ctx.req.socket.isModernBrowser).toEqual(true)
    expect(ctx.req.modernMode).toEqual(true)
  })

  test('should detect legacy browser based on user-agent', () => {
    const context = createContext()
    const modernMiddleware = createModernMiddleware({ context })
    const ctx = createServerContext()
    const ua = 'Mozilla/5.0 (Windows; U; MSIE 9.0; WIndows NT 9.0; en-US))'
    ctx.req.headers['user-agent'] = ua
    ctx.req.socket = {}

    context.options.dev = true
    context.options.modern = 'client'
    modernMiddleware(ctx.req, ctx.res, ctx.next)

    expect(ctx.req.socket.isModernBrowser).toEqual(false)
  })

  test('should ignore illegal user-agent', () => {
    const context = createContext()
    const modernMiddleware = createModernMiddleware({ context })
    const ctx = createServerContext()
    const ua = 'illegal user agent'
    ctx.req.headers['user-agent'] = ua
    ctx.req.socket = {}

    context.options.dev = true
    context.options.modern = 'client'
    modernMiddleware(ctx.req, ctx.res, ctx.next)

    expect(ctx.req.socket.isModernBrowser).toEqual(false)
  })
})
