import generateETag from 'etag'
import fresh from 'fresh'
import consola from 'consola'

import createNuxtMiddleware from '../../src/middleware/nuxt'

jest.mock('etag', () => jest.fn(() => 'etag-hash'))
jest.mock('fresh')

const createContext = () => ({
  options: {
    render: { http2: false },
    build: {}
  },
  nuxt: {
    callHook: jest.fn()
  },
  renderRoute: jest.fn(),
  resources: {}
})

const createServerContext = () => ({
  req: { headers: {}, url: 'http://localhost/test/server' },
  res: { headers: {}, setHeader: jest.fn(), end: jest.fn() },
  next: jest.fn()
})

describe('server: nuxtMiddleware', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  test('should return nuxt middleware', () => {
    const nuxtMiddleware = createNuxtMiddleware({})
    expect(nuxtMiddleware).toBeInstanceOf(Function)
  })

  test('should render route in nuxt middleware', async () => {
    const context = createContext()
    const result = { html: 'rendered html' }
    context.renderRoute.mockReturnValue(result)
    const nuxtMiddleware = createNuxtMiddleware(context)
    const { req, res, next } = createServerContext()

    const html = await nuxtMiddleware(req, res, next)

    expect(context.renderRoute).toBeCalledTimes(1)
    expect(context.renderRoute).toBeCalledWith(req.url, { req, res })

    expect(context.nuxt.callHook).toBeCalledTimes(3)
    expect(context.nuxt.callHook).nthCalledWith(1, 'render:route', req.url, result, { req, res })
    expect(context.nuxt.callHook).nthCalledWith(2, 'render:beforeResponse', req.url, result, { req, res })
    expect(context.nuxt.callHook).nthCalledWith(3, 'render:routeDone', req.url, result, { req, res })

    expect(res.setHeader).toBeCalledTimes(3)
    expect(res.setHeader).nthCalledWith(1, 'Content-Type', 'text/html; charset=utf-8')
    expect(res.setHeader).nthCalledWith(2, 'Accept-Ranges', 'none')
    expect(res.setHeader).nthCalledWith(3, 'Content-Length', Buffer.byteLength(result.html))

    expect(res.end).toBeCalledTimes(1)
    expect(res.end).toBeCalledWith(result.html, 'utf8')
    expect(res.statusCode).toEqual(200)
    expect(html).toEqual(result.html)
  })

  test('should early return if route is redirected', async () => {
    const context = createContext()
    const result = { html: 'rendered html', redirected: true }
    context.renderRoute.mockReturnValue(result)
    const nuxtMiddleware = createNuxtMiddleware(context)
    const { req, res, next } = createServerContext()

    const html = await nuxtMiddleware(req, res, next)

    expect(context.nuxt.callHook).toBeCalledTimes(2)
    expect(context.nuxt.callHook).nthCalledWith(1, 'render:route', req.url, result, { req, res })
    expect(context.nuxt.callHook).nthCalledWith(2, 'render:routeDone', req.url, result, { req, res })

    expect(res.setHeader).not.toBeCalled()
    expect(res.end).not.toBeCalled()
    expect(res.statusCode).toEqual(200)
    expect(html).toEqual(result.html)
  })

  test('should set error status code when error occurred', async () => {
    const context = createContext()
    const result = { html: 'rendered html', error: new Error('render error') }
    const nuxt = { error: { statusCode: 404 } }
    context.renderRoute.mockImplementation((url, ctx) => {
      ctx.nuxt = nuxt
      return result
    })
    const nuxtMiddleware = createNuxtMiddleware(context)
    const { req, res, next } = createServerContext()

    const html = await nuxtMiddleware(req, res, next)

    expect(context.nuxt.callHook).toBeCalledTimes(3)
    expect(context.nuxt.callHook).nthCalledWith(1, 'render:route', req.url, result, { req, res, nuxt })
    expect(context.nuxt.callHook).nthCalledWith(2, 'render:beforeResponse', req.url, result, { req, res, nuxt })
    expect(context.nuxt.callHook).nthCalledWith(3, 'render:routeDone', req.url, result, { req, res, nuxt })

    expect(res.statusCode).toEqual(404)
    expect(html).toEqual(result.html)
  })

  test('should add etag after rendering', async () => {
    const context = createContext()
    const result = { html: 'rendered html' }
    context.renderRoute.mockReturnValue(result)
    context.options.render.etag = true
    const nuxtMiddleware = createNuxtMiddleware(context)
    const { req, res, next } = createServerContext()

    await nuxtMiddleware(req, res, next)

    expect(generateETag).toBeCalledTimes(1)
    expect(generateETag).toBeCalledWith('rendered html', true)
    expect(res.setHeader).nthCalledWith(1, 'ETag', 'etag-hash')
  })

  test('should set etag after rendering through hook', async () => {
    const context = createContext()
    const hash = jest.fn(() => 'etag-hook')
    context.options.render.etag = { hash }

    const result = { html: 'rendered html' }
    context.renderRoute.mockReturnValue(result)
    const nuxtMiddleware = createNuxtMiddleware(context)
    const { req, res, next } = createServerContext()

    await nuxtMiddleware(req, res, next)

    expect(hash).toBeCalledWith('rendered html', expect.any(Object))
    expect(res.setHeader).nthCalledWith(1, 'ETag', 'etag-hook')
  })

  test('should return 304 if request is fresh', async () => {
    const context = createContext()
    const result = { html: 'rendered html' }
    context.renderRoute.mockReturnValue(result)
    context.options.render.etag = true
    const nuxtMiddleware = createNuxtMiddleware(context)
    const { req, res, next } = createServerContext()
    fresh.mockReturnValue(true)

    await nuxtMiddleware(req, res, next)

    expect(res.statusCode).toEqual(304)
    expect(context.nuxt.callHook).toBeCalledTimes(3)
    expect(context.nuxt.callHook).nthCalledWith(1, 'render:route', req.url, result, { req, res })
    expect(context.nuxt.callHook).nthCalledWith(2, 'render:beforeResponse', req.url, result, { req, res })
    expect(context.nuxt.callHook).nthCalledWith(3, 'render:routeDone', req.url, result, { req, res })
    expect(res.end).toBeCalledTimes(1)
    expect(res.end).toBeCalledWith()
  })

  test('should add http2 links header if http2 push is enabled', async () => {
    const context = createContext()
    const result = {
      html: 'rendered html',
      preloadFiles: ['/nuxt/preload1.js', '/nuxt/preload2.js']
    }
    context.renderRoute.mockReturnValue(result)
    const pushAssets = jest.fn((req, res, publicPath, preloadFiles) => preloadFiles)
    context.options.render.http2 = { push: true, pushAssets }
    context.resources = { clientManifest: { publicPath: '/nuxt' } }

    const nuxtMiddleware = createNuxtMiddleware(context)
    const { req, res, next } = createServerContext()
    fresh.mockReturnValue(true)

    await nuxtMiddleware(req, res, next)

    expect(pushAssets).toBeCalledWith(req, res, '/nuxt', ['/nuxt/preload1.js', '/nuxt/preload2.js'])
    expect(res.setHeader).nthCalledWith(1, 'Link', '/nuxt/preload1.js, /nuxt/preload2.js')
  })

  test('should only include script and style in http2 push by default', async () => {
    const context = createContext()
    const result = {
      html: 'rendered html',
      preloadFiles: [
        { file: '/nuxt/preload1.js', asType: 'script' },
        { file: '/nuxt/preload2.js', asType: 'script' },
        { file: '/nuxt/style.css', asType: 'style' },
        { file: '/nuxt/font.woff', asType: 'font' }
      ]
    }
    context.renderRoute.mockReturnValue(result)
    context.options.render.http2 = { push: true }
    context.resources = { clientManifest: { publicPath: '/nuxt' } }

    const nuxtMiddleware = createNuxtMiddleware(context)
    const { req, res, next } = createServerContext()
    fresh.mockReturnValue(true)

    await nuxtMiddleware(req, res, next)

    expect(res.setHeader).nthCalledWith(1, 'Link', '</nuxt/nuxt/preload1.js>; rel=preload; as=script, </nuxt/nuxt/preload2.js>; rel=preload; as=script, </nuxt/nuxt/style.css>; rel=preload; as=style')
  })

  test('should ignore preload files which are excluded by shouldPush', async () => {
    const context = createContext()
    const result = {
      html: 'rendered html',
      preloadFiles: [
        { file: '/nuxt/preload1.js', asType: 'script' },
        { file: '/nuxt/preload2.js', asType: 'script', modern: true },
        { file: '/nuxt/style.css', asType: 'style' },
        { file: '/nuxt/font.woff', asType: 'font' }
      ]
    }
    context.renderRoute.mockReturnValue(result)
    context.options.dev = true
    context.options.render.crossorigin = 'use-credentials'
    context.options.render.http2 = {
      push: true,
      shouldPush: jest.fn((fileWithoutQuery, asType) => asType === 'script')
    }
    context.resources = { clientManifest: { publicPath: '/nuxt' } }

    const nuxtMiddleware = createNuxtMiddleware(context)
    const { req, res, next } = createServerContext()
    fresh.mockReturnValue(true)

    await nuxtMiddleware(req, res, next)

    expect(consola.warn).toBeCalledWith('http2.shouldPush is deprecated. Use http2.pushAssets function')
    expect(context.options.render.http2.shouldPush).toBeCalledTimes(4)
    expect(res.setHeader).nthCalledWith(1, 'Link', '</nuxt/nuxt/preload1.js>; rel=preload; crossorigin=use-credentials; as=script, </nuxt/nuxt/preload2.js>; rel=modulepreload; crossorigin=use-credentials; as=script')
  })

  test('should add csp header if csp is enabled', async () => {
    const context = createContext()
    const result = { html: 'rendered html', cspScriptSrcHashes: ['sha256-hashes'] }
    context.renderRoute.mockReturnValue(result)
    context.options.render.csp = true

    const nuxtMiddleware = createNuxtMiddleware(context)
    const { req, res, next } = createServerContext()
    fresh.mockReturnValue(true)

    await nuxtMiddleware(req, res, next)

    expect(res.setHeader).nthCalledWith(1, 'Content-Security-Policy', "script-src 'self' sha256-hashes")
  })

  test('should support allowedSources for setting csp header', async () => {
    const context = createContext()
    const result = { html: 'rendered html', cspScriptSrcHashes: ['sha256-hashes'] }
    context.renderRoute.mockReturnValue(result)
    context.options.dev = true
    context.options.render.csp = {
      reportOnly: true,
      allowedSources: ['/nuxt/*.js', '/nuxt/images/*']
    }

    const nuxtMiddleware = createNuxtMiddleware(context)
    const { req, res, next } = createServerContext()
    fresh.mockReturnValue(true)

    await nuxtMiddleware(req, res, next)

    expect(res.setHeader).nthCalledWith(
      1,
      'Content-Security-Policy-Report-Only',
      "script-src 'self' sha256-hashes /nuxt/*.js /nuxt/images/*"
    )
  })

  test('should support policies for setting csp header', async () => {
    const context = createContext()
    const result = { html: 'rendered html', cspScriptSrcHashes: ['sha256-hashes'] }
    context.renderRoute.mockReturnValue(result)
    context.options.dev = true
    context.options.render.csp = {
      policies: {
        'script-src': [
          '/nuxt.js',
          '/test.js'
        ],
        'report-uri': [
          '/report'
        ]
      }
    }

    const nuxtMiddleware = createNuxtMiddleware(context)
    const { req, res, next } = createServerContext()
    fresh.mockReturnValue(true)

    await nuxtMiddleware(req, res, next)

    expect(res.setHeader).nthCalledWith(
      1,
      'Content-Security-Policy',
      "script-src sha256-hashes 'self' /nuxt.js /test.js; report-uri /report"
    )
  })

  test('should catch error during running nuxt middleware', async () => {
    const context = createContext()
    const err = Error('render error')
    context.renderRoute.mockImplementation(() => {
      throw err
    })
    const nuxtMiddleware = createNuxtMiddleware(context)
    const { req, res, next } = createServerContext()
    fresh.mockReturnValue(true)

    await nuxtMiddleware(req, res, next)

    expect(next).toBeCalledWith(err)
  })

  test('should log and return error during redirecting in nuxt middleware', async () => {
    const context = createContext()
    const err = Error('render error')
    context.renderRoute.mockImplementation((url, ctx) => {
      ctx.redirected = true
      throw err
    })
    const nuxtMiddleware = createNuxtMiddleware(context)
    const { req, res, next } = createServerContext()
    fresh.mockReturnValue(true)

    expect(await nuxtMiddleware(req, res, next)).toBe(err)
    expect(consola.error).toBeCalledWith(err)
  })

  test('should return 400 if request is uri error', async () => {
    const context = createContext()
    const result = { html: 'rendered html' }
    context.renderRoute.mockReturnValue(result)
    const nuxtMiddleware = createNuxtMiddleware(context)
    const { req, res, next } = createServerContext()

    const err = Error('URI malformed')
    err.name = 'URIError'

    await nuxtMiddleware({ ...req, url: 'http://localhost/test/server/%c1%81' }, res, next)

    expect(next).toBeCalledWith(err)
  })
})
