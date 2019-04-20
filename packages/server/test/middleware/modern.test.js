jest.mock('chalk', () => ({
  green: {
    bold: modern => `greenBold(${modern})`
  }
}))

const createServerContext = () => ({
  resources: {},
  options: {
    render: {}
  }
})

const createRenderContext = () => ({
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
    const serverContext = createServerContext()
    const modernMiddleware = createModernMiddleware({ serverContext })
    const ctx = createRenderContext()

    serverContext.options.modern = false
    modernMiddleware(ctx.req, ctx.res, ctx.next)
    serverContext.options.modern = 'client'
    modernMiddleware(ctx.req, ctx.res, ctx.next)
    serverContext.options.modern = 'server'
    modernMiddleware(ctx.req, ctx.res, ctx.next)

    expect(ctx.req._modern).toEqual(false)
  })

  test('should not detect modern browser if connect has been detected', () => {
    const serverContext = createServerContext()
    const modernMiddleware = createModernMiddleware({ serverContext })
    const ctx = createRenderContext()
    ctx.req.socket = { isModernBrowser: true }

    serverContext.options.dev = true
    serverContext.options.modern = 'server'
    modernMiddleware(ctx.req, ctx.res, ctx.next)

    expect(ctx.req._modern).toEqual(true)
  })

  test('should detect modern browser based on user-agent', () => {
    const serverContext = createServerContext()
    const modernMiddleware = createModernMiddleware({ serverContext })
    const ctx = createRenderContext()
    const ua = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/70.0.3538.77 Safari/537.36'
    ctx.req.headers['user-agent'] = ua
    ctx.req.socket = {}

    serverContext.options.dev = true
    serverContext.options.modern = 'server'
    modernMiddleware(ctx.req, ctx.res, ctx.next)

    expect(ctx.req.socket.isModernBrowser).toEqual(true)
    expect(ctx.req._modern).toEqual(true)
  })

  test('should detect legacy browser based on user-agent', () => {
    const serverContext = createServerContext()
    const modernMiddleware = createModernMiddleware({ serverContext })
    const ctx = createRenderContext()
    const ua = 'Mozilla/5.0 (Windows; U; MSIE 9.0; WIndows NT 9.0; en-US))'
    ctx.req.headers['user-agent'] = ua
    ctx.req.socket = {}

    serverContext.options.dev = true
    serverContext.options.modern = 'client'
    modernMiddleware(ctx.req, ctx.res, ctx.next)

    expect(ctx.req.socket.isModernBrowser).toEqual(false)
  })

  test('should ignore illegal user-agent', () => {
    const serverContext = createServerContext()
    const modernMiddleware = createModernMiddleware({ serverContext })
    const ctx = createRenderContext()
    const ua = 'illegal user agent'
    ctx.req.headers['user-agent'] = ua
    ctx.req.socket = {}

    serverContext.options.dev = true
    serverContext.options.modern = 'client'
    modernMiddleware(ctx.req, ctx.res, ctx.next)

    expect(ctx.req.socket.isModernBrowser).toEqual(false)
  })
})
