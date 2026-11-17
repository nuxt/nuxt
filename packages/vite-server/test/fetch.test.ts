import { afterEach, describe, expect, it, vi } from 'vitest'

import { createAppFetch } from '../src/runtime/fetch.ts'
import { createFetchHandler } from '../src/runtime/renderer.ts'
import type { NuxtRenderer } from '../src/runtime/renderer.ts'

describe('`$fetch` on the vite server', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('sends a path of the app to its handler with the context given', async () => {
    const renderer: NuxtRenderer = {
      fetch: (event) => {
        const seeded = { ...event.context }
        ;(event.context as Record<string, unknown>).rendered = true
        return Promise.resolve(Response.json({ url: event.req.url, cookie: event.req.headers.get('cookie'), context: seeded }))
      },
    }
    const fetch = createAppFetch(() => Promise.resolve(createFetchHandler(renderer, () => ({}))))
    const context = { user: 'daniel' }

    const response = await fetch('/base/about?a=1', { headers: { cookie: 'a=1' } }, context)

    expect(await response.json()).toEqual({ url: 'http://localhost/base/about?a=1', cookie: 'a=1', context: { user: 'daniel' } })
    expect(context).toEqual({ user: 'daniel' })
  })

  it('seeds the error page render with the context given', async () => {
    const renderer: NuxtRenderer = {
      fetch: event => event.url.pathname === '/__nuxt_error'
        ? Promise.resolve(new Response(String((event.context as Record<string, unknown>).user)))
        : Promise.reject(new Error('boom')),
    }
    const fetch = createAppFetch(() => Promise.resolve(createFetchHandler(renderer, () => ({}))))

    const response = await fetch('/about', { headers: { accept: 'text/html' } }, { user: 'daniel' })

    expect(response.status).toBe(500)
    expect(await response.text()).toBe('daniel')
  })

  it('keeps a protocol-relative path on the app', async () => {
    const handler = vi.fn((request: Request) => Promise.resolve(new Response(new URL(request.url).host)))

    expect(await (await createAppFetch(() => Promise.resolve(handler))('//example.com/x')).text()).toBe('localhost')
  })

  it('rejects an in-flight request to the app once its signal is aborted', async () => {
    let markStarted!: () => void
    const started = new Promise<void>((resolve) => { markStarted = resolve })
    const renderer: NuxtRenderer = {
      fetch: () => {
        markStarted()
        return new Promise<Response>(() => {})
      },
    }
    const fetch = createAppFetch(() => Promise.resolve(createFetchHandler(renderer, () => ({}))))
    const controller = new AbortController()
    const response = fetch('/slow', { signal: controller.signal })
    const rejection = expect(response).rejects.toThrow('timeout')

    await started
    controller.abort(new Error('timeout'))

    await rejection
  })

  it('does not send a request to the app once its signal is aborted while loading', async () => {
    const renderer: NuxtRenderer = { fetch: vi.fn(() => Promise.resolve(new Response('ok'))) }
    const handler = createFetchHandler(renderer, () => ({}))
    let finishLoading!: () => void
    const loading = new Promise<void>((resolve) => { finishLoading = resolve })
    const fetch = createAppFetch(() => loading.then(() => handler))
    const controller = new AbortController()
    const response = fetch('/slow', { signal: controller.signal })
    const rejection = expect(response).rejects.toThrow('timeout')

    controller.abort(new Error('timeout'))
    finishLoading()

    await rejection
    expect(renderer.fetch).not.toHaveBeenCalled()
  })

  it('follows a redirect of the app', async () => {
    const handler = vi.fn((request: Request) => {
      const { pathname } = new URL(request.url)
      return Promise.resolve(pathname === '/old'
        ? new Response('<meta http-equiv="refresh">', { status: 302, headers: { location: '/new?a=1' } })
        : new Response(`page ${pathname}`))
    })
    const fetch = createAppFetch(() => Promise.resolve(handler))

    expect(await (await fetch('/old')).text()).toBe('page /new')
    expect(handler).toHaveBeenCalledTimes(2)
  })

  it('returns a redirect of the app when asked not to follow it', async () => {
    const handler = () => Promise.resolve(new Response(null, { status: 302, headers: { location: '/new' } }))

    const response = await createAppFetch(() => Promise.resolve(handler))('/old', { redirect: 'manual' })

    expect(response.status).toBe(302)
    expect(response.headers.get('location')).toBe('/new')
  })

  it('sends the redirected request of a POST as a GET after a 303', async () => {
    const handler = vi.fn((request: Request) => Promise.resolve(new Response(
      request.method,
      request.url.endsWith('/old') ? { status: 303, headers: { location: '/new' } } : {},
    )))

    expect(await (await createAppFetch(() => Promise.resolve(handler))('/old', { method: 'POST', body: 'a=1' })).text()).toBe('GET')
  })

  it('drops the body headers of a POST redirected to a GET', async () => {
    const handler = vi.fn((request: Request) => Promise.resolve(request.url.endsWith('/old')
      ? new Response(null, { status: 303, headers: { location: '/new' } })
      : new Response(`${request.method} ${request.headers.get('content-type')}`)))

    const response = await createAppFetch(() => Promise.resolve(handler))('/old', {
      method: 'POST',
      body: 'a=1',
      headers: { 'content-type': 'text/plain' },
    })

    expect(await response.text()).toBe('GET null')
  })

  it('does not send the credentials of a request to a redirect on another origin', async () => {
    const platform = vi.fn((_input: RequestInfo | URL, _init?: RequestInit) => Promise.resolve(new Response('platform')))
    vi.stubGlobal('fetch', platform)
    const handler = vi.fn(() => Promise.resolve(new Response(null, { status: 302, headers: { location: 'https://example.com/x' } })))

    await createAppFetch(() => Promise.resolve(handler))('/old', {
      headers: { 'authorization': 'Bearer token', 'cookie': 'a=1', 'x-keep': 'yes' },
    })

    const sent = new Headers(platform.mock.calls[0]![1]!.headers)
    expect(sent.get('authorization')).toBeNull()
    expect(sent.get('cookie')).toBeNull()
    expect(sent.get('x-keep')).toBe('yes')
  })

  it('rejects a redirect that must resend a streamed body', async () => {
    const handler = () => Promise.resolve(new Response(null, { status: 307, headers: { location: '/new' } }))
    const body = new ReadableStream({
      start (controller) {
        controller.enqueue(new TextEncoder().encode('a=1'))
        controller.close()
      },
    })

    await expect(createAppFetch(() => Promise.resolve(handler))('/old', { method: 'POST', body, duplex: 'half' } as RequestInit))
      .rejects.toThrow('streamed body')
  })

  it('sends a lowercase POST redirected by a 302 as a GET', async () => {
    const handler = vi.fn((request: Request) => Promise.resolve(request.url.endsWith('/old')
      ? new Response(null, { status: 302, headers: { location: '/new' } })
      : new Response(request.method)))

    expect(await (await createAppFetch(() => Promise.resolve(handler))('/old', { method: 'post', body: 'a=1' })).text()).toBe('GET')
  })

  it('does not render a request whose signal is already aborted', async () => {
    const renderer: NuxtRenderer = { fetch: vi.fn(() => Promise.resolve(new Response('rendered'))) }
    const controller = new AbortController()
    controller.abort(new Error('timeout'))

    await expect(createFetchHandler(renderer, () => ({}))(new Request('http://localhost/about', { signal: controller.signal })))
      .rejects.toThrow('timeout')
    expect(renderer.fetch).not.toHaveBeenCalled()
  })

  it('does not render an error page for a request aborted while rendering', async () => {
    const controller = new AbortController()
    const renderer: NuxtRenderer = {
      fetch: vi.fn(() => {
        controller.abort(new Error('timeout'))
        return Promise.reject(new Error('boom'))
      }),
    }

    await expect(createFetchHandler(renderer, () => ({}))(new Request('http://localhost/about', { signal: controller.signal })))
      .rejects.toThrow('timeout')
    expect(renderer.fetch).toHaveBeenCalledTimes(1)
  })

  it('sends any other request to the platform', async () => {
    const platform = vi.fn(() => Promise.resolve(new Response('platform')))
    vi.stubGlobal('fetch', platform)
    const handler = vi.fn()

    expect(await (await createAppFetch(handler)('https://example.com/api', { method: 'POST' }, { user: 'daniel' })).text()).toBe('platform')
    expect(platform).toHaveBeenCalledWith('https://example.com/api', { method: 'POST' })
    expect(handler).not.toHaveBeenCalled()
  })
})
