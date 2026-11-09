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

  it('sends any other request to the platform', async () => {
    const platform = vi.fn(() => Promise.resolve(new Response('platform')))
    vi.stubGlobal('fetch', platform)
    const handler = vi.fn()

    expect(await (await createAppFetch(handler)('https://example.com/api', { method: 'POST' }, { user: 'daniel' })).text()).toBe('platform')
    expect(platform).toHaveBeenCalledWith('https://example.com/api', { method: 'POST' })
    expect(handler).not.toHaveBeenCalled()
  })
})
