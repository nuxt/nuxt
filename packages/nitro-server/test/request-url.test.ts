import { describe, expect, it, vi } from 'vitest'
import { H3Event, getRequestURL, toRequest } from 'nitro/h3'
import { appEvent } from 'nuxt/internal/renderer/runtime'
import type { RendererEvent } from 'nuxt/internal/renderer/runtime'

import * as nuxt4 from '../src/runtime/host/nuxt4.ts'
import { withoutBaseURL } from '../src/runtime/utils/base.ts'
import { decorateLegacyEvent } from '../src/runtime/compat/decorate.ts'

vi.mock('nitro/runtime-config', () => ({ useRuntimeConfig: () => ({ app: { baseURL: '/foo/' } }) }))
vi.mock('#internal/nuxt/host', () => vi.importActual('../src/runtime/host/nuxt4.ts'))
vi.mock('nitro', () => ({
  serverFetch: (resource: string, init: RequestInit, context: Record<string, unknown>) => {
    const request = toRequest(resource, init) as Request & { context?: Record<string, unknown> }
    request.context = { ...request.context, ...context }
    return dispatch(new H3Event(request))
  },
}))

const { default: baseURLMiddleware } = await import('../src/runtime/middleware/base-url.ts')

let rendered: { rendererURL: string, app: H3Event } | undefined

const renderer = {
  fetch: (event: RendererEvent) => {
    rendered = { rendererURL: event.url.href, app: appEvent(event) as unknown as H3Event }
    return Promise.resolve(new Response('ok'))
  },
}

async function render (event: H3Event) {
  await nuxt4.renderPage(renderer, event as unknown as RendererEvent)
  return new Response('ok')
}

function request (url: string, headers: Record<string, string> = {}) {
  return new Request(url, { headers: { host: new URL(url).host, ...headers } })
}

async function dispatch (event: H3Event) {
  return await (baseURLMiddleware as unknown as (event: H3Event) => Promise<Response | undefined>)(event) ?? render(event)
}

async function renderWithRuntimeBase (url: string, headers?: Record<string, string>) {
  rendered = undefined
  await dispatch(new H3Event(request(url, headers)))
  return rendered!
}

async function renderWithBuildBase (url: string, headers?: Record<string, string>) {
  rendered = undefined
  const event = new H3Event(request(url, headers))
  event.url = withoutBaseURL(event.url, '/foo')
  await render(event)
  return rendered!
}

describe.each([
  ['runtime base URL', renderWithRuntimeBase],
  ['build-time base URL', renderWithBuildBase],
])('nuxt 4 request URL with a %s', (_name, renderPage) => {
  it('gives the app the URL the request arrived with', async () => {
    const { rendererURL, app } = await renderPage('http://example.com/foo/url?a=1')

    expect(new URL(rendererURL).pathname).toBe('/url')
    expect(getRequestURL(app).href).toBe('http://example.com/foo/url?a=1')
    expect((app as { path?: string }).path).toBe('/url?a=1')
  })

  it('gives the app the URL the request arrived with in canonical form', async () => {
    const { rendererURL, app } = await renderPage('http://example.com/foo/%61dmin?a=%61')

    expect(new URL(rendererURL).pathname).toBe('/admin')
    expect(getRequestURL(app).href).toBe('http://example.com/foo/admin?a=%61')
  })

  it('applies forwarded headers to the URL the request arrived with', async () => {
    const { app } = await renderPage('http://example.com/foo/url', { 'x-forwarded-host': 'proxy.example', 'x-forwarded-proto': 'https' })

    expect(getRequestURL(app).href).toBe('http://example.com/foo/url')
    expect(getRequestURL(app, { xForwardedHost: true, xForwardedProto: true }).href).toBe('https://proxy.example/foo/url')
  })
})

describe('nuxt 4 request event', () => {
  it('is the render event for a request without a base URL', async () => {
    rendered = undefined
    const event = new H3Event(request('http://example.com/url'))
    await nuxt4.renderPage(renderer, event as unknown as RendererEvent)

    expect(rendered!.app).toBe(event)
  })

  it('is the render event for a non-canonical request without a base URL', async () => {
    rendered = undefined
    const event = new H3Event(request('http://example.com/%61dmin'))
    await nuxt4.renderPage(renderer, event as unknown as RendererEvent)

    expect(rendered!.app).toBe(event)
  })

  it('shares the request, context and response of the render event', async () => {
    const event = new H3Event(request('http://example.com/foo/url'))
    event.url = withoutBaseURL(event.url, '/foo')
    await nuxt4.renderPage(renderer, event as unknown as RendererEvent)
    const app = rendered!.app

    expect(app).not.toBe(event)
    expect(app).toBeInstanceOf(H3Event)
    expect(app.req).toBe(event.req)
    expect(app.context).toBe(event.context)
    expect(app.res).toBe(event.res)
    app.res.headers.set('x-app', '1')
    expect(event.res.headers.get('x-app')).toBe('1')
  })

  it('keeps the Nitro v2 decoration of the render event', async () => {
    const event = decorateLegacyEvent(new H3Event(request('http://example.com/foo/url')))
    event.url = withoutBaseURL(event.url, '/foo')
    await nuxt4.renderPage(renderer, event as unknown as RendererEvent)
    type LegacyEvent = { $fetch?: unknown, captureError?: unknown, node?: { req: { url: string } } }
    const app = rendered!.app as unknown as LegacyEvent

    expect(app).not.toBe(event)
    expect(app.$fetch).toBe((event as unknown as LegacyEvent).$fetch)
    expect(app.captureError).toBeTypeOf('function')
    expect(app.node?.req.url).toBe('/url')
  })
})
