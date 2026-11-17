import { describe, expect, it, vi } from 'vitest'
import { H3Event, getRequestURL, toRequest } from 'nitro/h3'
import { appEvent } from 'nuxt/internal/renderer/runtime'
import type { RendererEvent } from 'nuxt/internal/renderer/runtime'

import { withoutBaseURL } from '../src/runtime/utils/base.ts'

vi.mock('nitro/runtime-config', () => ({ useRuntimeConfig: () => ({ app: { baseURL: '/foo/' } }) }))
vi.mock('#internal/nuxt/host', () => vi.importActual('../src/runtime/host/nuxt5.ts'))
vi.mock('nitro', () => ({
  serverFetch: (resource: string, init: RequestInit, context: Record<string, unknown>) => {
    const request = toRequest(resource, init) as Request & { context?: Record<string, unknown> }
    request.context = { ...request.context, ...context }
    return dispatch(new H3Event(request))
  },
}))

const nuxt4 = await vi.importActual<typeof import('../src/runtime/host/nuxt4.ts')>('../src/runtime/host/nuxt4.ts')
const nuxt5 = await vi.importActual<typeof import('../src/runtime/host/nuxt5.ts')>('../src/runtime/host/nuxt5.ts')
const { default: baseURLMiddleware } = await import('../src/runtime/middleware/base-url.ts')

describe('renderer hosts', () => {
  it('provide the same names', () => {
    expect(Object.keys(nuxt4).sort()).toEqual(Object.keys(nuxt5).sort())
  })
})

let rendered: { rendererURL: string, app: H3Event } | undefined

const renderer = {
  fetch: (event: RendererEvent) => {
    rendered = { rendererURL: event.url.href, app: appEvent(event) as unknown as H3Event }
    return Promise.resolve(new Response('ok'))
  },
}

async function render (event: H3Event) {
  await nuxt5.renderPage(renderer, event as unknown as RendererEvent)
  return new Response('ok')
}

async function dispatch (event: H3Event) {
  return await (baseURLMiddleware as unknown as (event: H3Event) => Promise<Response | undefined>)(event) ?? render(event)
}

async function renderWithRuntimeBase (url: string) {
  rendered = undefined
  await dispatch(new H3Event(new Request(url)))
  return rendered!
}

async function renderWithBuildBase (url: string) {
  rendered = undefined
  const event = new H3Event(new Request(url))
  event.url = withoutBaseURL(event.url, '/foo')
  await render(event)
  return rendered!
}

describe.each([
  ['runtime base URL', renderWithRuntimeBase],
  ['build-time base URL', renderWithBuildBase],
])('nuxt 5 request URL with a %s', (_name, renderPage) => {
  it('gives the app the URL relative to the base', async () => {
    const { rendererURL, app } = await renderPage('http://example.com/foo/url?a=1')

    expect(app.url.href).toBe(rendererURL)
    expect(getRequestURL(app).pathname).toBe('/url')
  })
})
