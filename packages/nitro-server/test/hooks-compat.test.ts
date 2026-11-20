import { mkdtemp, writeFile } from 'node:fs/promises'
import { openAsBlob } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it, onTestFinished, vi } from 'vitest'
import { HookableCore, createHooks } from 'hookable'
import { H3, HTTPError, mockEvent } from 'nitro/h3'

import { serverDiagnostics } from '../src/runtime/diagnostics.ts'
import { hasLegacyHookListener, observeLegacyHooks } from '../src/runtime/compat/hook-registry.ts'
import { markStreamedResponse } from '../src/runtime/compat/render-response.ts'
import { applyLegacyRenderBefore } from '../src/runtime/compat/render-before.ts'
import { prepareLegacyEvent } from '../src/runtime/compat/event.ts'
import type { LegacyH3Event } from '../src/runtime/compat/h3-v1.ts'
import plugin from '../src/runtime/compat/hooks-plugin.ts'
import { wrapLegacyPlugin } from '../src/runtime/compat/legacy-plugin.ts'

function createNitroApp () {
  const handlers = new Map<string, (...args: any[]) => any>()
  const hooks = {
    hook: (name: string, handler: (...args: any[]) => any) => handlers.set(name, handler),
    callHook: (name: string, ...args: any[]) => handlers.get(name)?.(...args),
  }
  const nitroApp = { hooks }
  plugin(nitroApp as any)
  return { nitroApp, hooks, handlers }
}

describe('nitro v2 runtime hook bridge', () => {
  it('hands the buffered body to `beforeResponse` and `afterResponse`', async () => {
    const { hooks, handlers } = createNitroApp()

    const seen: unknown[] = []
    hooks.hook('beforeResponse', (_event, response) => seen.push(response.body))
    hooks.hook('afterResponse', (_event, response) => seen.push(response.body))

    // no `content-length`: a `Response` built from a string does not carry one until the
    // runtime writes it, and its body is buffered all the same
    await handlers.get('response')!(new Response('rendered'), {})

    expect(seen).toEqual(['rendered', 'rendered'])
  })

  it('does not touch the response when nothing is listening', async () => {
    const { handlers } = createNitroApp()
    const response = new Response('rendered', { headers: { 'content-length': '8' } })
    const clone = vi.spyOn(response, 'clone')

    await handlers.get('response')!(response, {})

    expect(clone).not.toHaveBeenCalled()
  })

  it('reports a streamed body read once per hook', async () => {
    const report = vi.spyOn(serverDiagnostics, 'NUXT_E8011').mockImplementation(() => ({}) as any)
    const { hooks, handlers } = createNitroApp()

    const seen: unknown[] = []
    hooks.hook('beforeResponse', (_event, response) => {
      seen.push(response.body, response.body)
    })

    const streamed = new Response(new ReadableStream({ start (controller) { controller.close() } }))
    markStreamedResponse(streamed)
    await handlers.get('response')!(streamed, {})
    await handlers.get('response')!(streamed, {})

    expect(seen).toEqual([undefined, undefined, undefined, undefined])
    expect(report).toHaveBeenCalledTimes(1)
    expect(report.mock.calls[0]![0]).toMatchObject({ hook: 'beforeResponse' })
    report.mockRestore()
  })

  it('hands over the body of an unmarked stream that is already complete', async () => {
    const { hooks, handlers } = createNitroApp()

    const seen: unknown[] = []
    hooks.hook('beforeResponse', (_event, response) => seen.push(response.body))

    const encoder = new TextEncoder()
    const response = new Response(new ReadableStream({
      start (controller) {
        controller.enqueue(encoder.encode('in '))
        controller.enqueue(encoder.encode('hand'))
        controller.close()
      },
    }))
    await handlers.get('response')!(response, {})

    expect(seen).toEqual(['in hand'])
    expect(await response.text()).toBe('in hand')
  })

  it('does not hold an unmarked live stream until it ends', async () => {
    const report = vi.spyOn(serverDiagnostics, 'NUXT_E8011').mockImplementation(() => ({}) as any)
    const hooks = createHooks()
    plugin({ hooks } as any)

    let close!: () => void
    const response = new Response(new ReadableStream({
      start (controller) {
        controller.enqueue(new TextEncoder().encode('first'))
        close = () => controller.close()
      },
    }))
    const seen: unknown[] = []
    hooks.hook('beforeResponse', (_event: unknown, legacy: { body: unknown }) => { seen.push(legacy.body) })

    let settled = false
    const pending = Promise.resolve(hooks.callHook('response', response, mockEvent('http://nuxt/stream'))).then(() => { settled = true })
    await vi.waitFor(() => expect(settled).toBe(true))

    expect(seen).toEqual([undefined])
    expect(report).toHaveBeenCalledTimes(1)

    close()
    await pending
    expect(await response.text()).toBe('first')
    report.mockRestore()
  })

  it('stops reading an unmarked stream that keeps producing without yielding', async () => {
    const report = vi.spyOn(serverDiagnostics, 'NUXT_E8011').mockImplementation(() => ({}) as any)
    const { hooks, handlers } = createNitroApp()

    const seen: unknown[] = []
    hooks.hook('beforeResponse', (_event, response) => seen.push(response.body))

    let pulls = 0
    const chunk = new Uint8Array([120])
    const response = new Response(new ReadableStream({
      pull (controller) {
        controller.enqueue(chunk)
        if (++pulls >= 300_000) {
          controller.close()
        }
      },
    }))
    await handlers.get('response')!(response, {})

    expect(seen).toEqual([undefined])
    expect(pulls).toBeLessThan(300_000)
    report.mockRestore()
  })

  it('hands over the body of a response of declared length that arrives after the first turn', async () => {
    const { hooks, handlers } = createNitroApp()

    const seen: unknown[] = []
    hooks.hook('beforeResponse', (_event, response) => seen.push(response.body))

    const response = new Response(new ReadableStream({
      start (controller) {
        setTimeout(() => {
          controller.enqueue(new TextEncoder().encode('late'))
          controller.close()
        }, 5)
      },
    }), { headers: { 'content-length': '4' } })
    await handlers.get('response')!(response, {})

    expect(seen).toEqual(['late'])
    expect(await response.text()).toBe('late')
  })

  it('hands over the body of a blob, a file and a file on disk returned by a handler', async () => {
    const { hooks, handlers } = createNitroApp()

    const seen = new Set<unknown>()
    hooks.hook('beforeResponse', (_event, response) => { seen.add(response.body) })

    const text = 'x'.repeat(300_000)
    const path = join(await mkdtemp(join(tmpdir(), 'nuxt-hooks-')), 'body.txt')
    await writeFile(path, text)
    const app = new H3()
      .get('/blob', () => new Blob([text]))
      .get('/file', () => new File([text], 'body.txt'))
      .get('/disk', () => openAsBlob(path))

    for (const route of ['/blob', '/file', '/disk']) {
      for (let i = 0; i < 20; i++) {
        await handlers.get('response')!(await app.fetch(new Request(`http://nuxt${route}`)), {})
      }
    }

    expect([...seen]).toEqual([text])
  })

  it('does not hold a response of declared length that does not end', async () => {
    const report = vi.spyOn(serverDiagnostics, 'NUXT_E8011').mockImplementation(() => ({}) as any)
    const { hooks, handlers } = createNitroApp()

    const seen: unknown[] = []
    hooks.hook('beforeResponse', (_event, response) => seen.push(response.body))

    const response = new Response(new ReadableStream({
      start (controller) {
        controller.enqueue(new TextEncoder().encode('first'))
      },
    }), { headers: { 'content-length': '100' } })
    await handlers.get('response')!(response, {})

    expect(seen).toEqual([undefined])
    expect(report).toHaveBeenCalledTimes(1)
    report.mockRestore()
  })

  it('reports an attempted body replacement once per hook', async () => {
    const report = vi.spyOn(serverDiagnostics, 'NUXT_E8008').mockImplementation(() => ({}) as any)
    const { hooks, handlers } = createNitroApp()

    hooks.hook('beforeResponse', (_event, response) => { response.body = 'replaced' })

    await handlers.get('response')!(new Response('ok', { headers: { 'content-length': '2' } }), {})
    await handlers.get('response')!(new Response('ok', { headers: { 'content-length': '2' } }), {})

    expect(report).toHaveBeenCalledTimes(1)
    report.mockRestore()
  })

  it('warns once per hook when a v2 response hook is registered without the bridge', () => {
    const report = vi.spyOn(serverDiagnostics, 'NUXT_E8010').mockImplementation(() => ({}) as any)
    const hooks = { hook: (_name: string, _fn: () => void) => () => {}, callHook: () => {} }
    observeLegacyHooks(hooks)

    hooks.hook('beforeResponse', () => {})
    hooks.hook('beforeResponse', () => {})
    hooks.hook('response', () => {})

    expect(report).toHaveBeenCalledTimes(1)
    expect(report.mock.calls[0]![0]).toMatchObject({ hook: 'beforeResponse' })
    report.mockRestore()
  })

  it('stops tracking a hook once its last listener is removed', () => {
    const hooks = new HookableCore<Record<string, () => void>>()
    observeLegacyHooks(hooks)

    const listener = () => {}
    const off = hooks.hook('render:response', () => {})
    hooks.hook('render:response', listener)
    off()
    expect(hasLegacyHookListener(hooks, 'render:response')).toBe(true)

    hooks.removeHook('render:response', () => {})
    expect(hasLegacyHookListener(hooks, 'render:response')).toBe(true)

    hooks.removeHook('render:response', listener)
    expect(hasLegacyHookListener(hooks, 'render:response')).toBe(false)
  })

  it('stops tracking a `hookOnce` listener once it has run', async () => {
    const hooks = createHooks<Record<string, () => void>>()
    observeLegacyHooks(hooks)

    hooks.hookOnce('render:response', () => {})
    expect(hasLegacyHookListener(hooks, 'render:response')).toBe(true)

    await hooks.callHook('render:response')
    expect(hasLegacyHookListener(hooks, 'render:response')).toBe(false)
  })

  it('does not warn about a v2 response hook once the bridge is installed', () => {
    const report = vi.spyOn(serverDiagnostics, 'NUXT_E8010').mockImplementation(() => ({}) as any)
    const { hooks } = createNitroApp()

    hooks.hook('beforeResponse', () => {})

    expect(report).not.toHaveBeenCalled()
    report.mockRestore()
  })

  it('applies header writes made on the event during `beforeResponse`', async () => {
    const { hooks, handlers } = createNitroApp()

    hooks.hook('beforeResponse', (event) => {
      event.res.headers.delete('x-route')
      event.res.headers.set('x-added', 'legacy')
      event.res.headers.set('x-shared', 'legacy')
      event.res.headers.append('set-cookie', 'session=1')
    })

    const response = new Response('ok', {
      headers: { 'content-length': '2', 'x-route': 'route', 'x-shared': 'route' },
    })
    const event = { res: { headers: new Headers({ 'x-route': 'route', 'x-shared': 'route' }) } }
    await handlers.get('response')!(response, event)

    expect(response.headers.get('x-route')).toBe(null)
    expect(response.headers.get('x-added')).toBe('legacy')
    expect(response.headers.get('x-shared')).toBe('legacy')
    expect(response.headers.getSetCookie()).toEqual(['session=1'])
  })

  it('leaves the response headers alone when no legacy hook wrote any', async () => {
    const { hooks, handlers } = createNitroApp()
    hooks.hook('beforeResponse', () => {})

    const response = new Response('ok', { headers: { 'content-length': '2', 'x-route': 'route' } })
    const original = [...response.headers]
    await handlers.get('response')!(response, { res: { headers: new Headers({ 'x-route': 'route' }) } })

    expect([...response.headers]).toEqual(original)
  })

  it('exposes the v3 response for hooks that need the real thing', async () => {
    const { hooks, handlers } = createNitroApp()
    const response = new Response('ok', { headers: { 'content-length': '2' } })

    let seen: unknown
    hooks.hook('beforeResponse', (_event, legacy) => { seen = legacy.response })
    await handlers.get('response')!(response, {})

    expect(seen).toBe(response)
  })
})

describe('nitro v2 `render:before` hook', () => {
  const page = () => vi.fn((_event: unknown) => Promise.resolve(new Response('<html>page</html>', { headers: { 'content-type': 'text/html' } })))

  it('renders the page after the listeners, with the v2 render context', async () => {
    const hooks = createHooks<Record<string, (context: any) => void>>()
    const event = mockEvent('http://nuxt/')
    const renderPage = page()
    let seen: Record<string, unknown> | undefined
    hooks.hook('render:before', (context) => { seen = { ...context } })

    const response = await applyLegacyRenderBefore(event, hooks, renderPage, (body, init) => new Response(body, init))

    expect(seen).toEqual({ event, render: expect.any(Function), response: undefined })
    expect(renderPage).toHaveBeenCalledExactlyOnceWith(event)
    expect(await response.text()).toBe('<html>page</html>')
  })

  it('responds with the response a listener sets, without rendering the page', async () => {
    const hooks = createHooks<Record<string, (context: any) => void>>()
    const event = prepareLegacyEvent(mockEvent('http://nuxt/')) as LegacyH3Event
    const renderPage = page()
    hooks.hook('render:before', (context) => {
      const { res } = context.event.node
      res.setHeader('location', '/fr')
      context.event.res.headers.append('set-cookie', 'i18n_redirected=fr; Path=/')
      context.response = {
        headers: { ...res.getHeaders(), 'x-redirect-by': 'render:before' },
        statusCode: 302,
        statusMessage: 'Found',
        body: '<!DOCTYPE html><html><head><meta http-equiv="refresh" content="0; url=/fr"></head></html>',
      }
    })

    const response = await applyLegacyRenderBefore(event, hooks, renderPage, (body, init) => new Response(body, init))

    expect(renderPage).not.toHaveBeenCalled()
    expect(response.status).toBe(302)
    expect(response.statusText).toBe('Found')
    expect(response.headers.get('location')).toBe('/fr')
    expect(response.headers.get('x-redirect-by')).toBe('render:before')
    expect(response.headers.getSetCookie()).toEqual(['i18n_redirected=fr; Path=/'])
    expect(response.headers.get('content-type')).toBe('text/html')
    expect(await response.text()).toContain('url=/fr')
  })

  it('keeps a streamed page live through a replaced `render`', async () => {
    const hooks = createHooks<Record<string, (context: any) => void>>()
    hooks.hook('render:before', (context) => {
      const render = context.render
      context.render = async (event: unknown) => ({ ...await render(event), headers: { 'x-wrapped': '1' } })
    })
    const renderPage = () => {
      const streamed = new Response(new ReadableStream({ start (controller) { controller.enqueue(new TextEncoder().encode('<html>')) } }))
      markStreamedResponse(streamed)
      return Promise.resolve(streamed)
    }

    const response = await applyLegacyRenderBefore(mockEvent('http://nuxt/'), hooks, renderPage, (body, init) => new Response(body, init))

    expect(response.headers.get('x-wrapped')).toBe('1')
    const { value } = await response.body!.getReader().read()
    expect(new TextDecoder().decode(value)).toBe('<html>')
  })

  it('fails the request when a replaced `render` returns no response', async () => {
    const hooks = createHooks<Record<string, (context: any) => void>>()
    hooks.hook('render:before', (context) => {
      context.render = () => Promise.resolve(undefined)
    })

    const response = await applyLegacyRenderBefore(mockEvent('http://nuxt/page'), hooks, page(), (body, init) => new Response(body, init))

    expect(response.status).toBe(500)
    expect(await response.text()).toBe('No response returned from render handler: /page')
  })

  it('keeps the status of a response a listener sets without a body', async () => {
    const hooks = createHooks<Record<string, (context: any) => void>>()
    hooks.hook('render:before', (context) => {
      context.response = { headers: { location: '/fr' }, statusCode: 302 }
    })

    const response = await applyLegacyRenderBefore(mockEvent('http://nuxt/'), hooks, page(), (body, init) => new Response(body, init))

    expect(response.status).toBe(302)
    expect(response.headers.get('location')).toBe('/fr')
    expect(await response.text()).toBe('')
  })

  function respondWith (response: Record<string, unknown>) {
    const hooks = createHooks<Record<string, (context: any) => void>>()
    hooks.hook('render:before', (context) => { context.response = response })
    return applyLegacyRenderBefore(mockEvent('http://nuxt/'), hooks, page(), (body, init) => new Response(body, init))
  }

  it('keeps the status and headers of a redirect a listener sets with an empty body', async () => {
    const response = await respondWith({ headers: { location: '/fr' }, statusCode: 302, body: '' })

    expect(response.status).toBe(302)
    expect(response.headers.get('location')).toBe('/fr')
    expect(await response.text()).toBe('')
  })

  it('responds with no content to a `null` body a listener sets', async () => {
    const response = await respondWith({ body: null, headers: { 'content-length': '4' } })

    expect(response.status).toBe(204)
    expect(response.headers.has('content-length')).toBe(false)
    expect(response.body).toBeNull()
  })

  it('keeps the status a listener sets with a `null` body', async () => {
    const response = await respondWith({ body: null, statusCode: 404 })

    expect(response.status).toBe(404)
    expect(await response.text()).toBe('')
  })

  it.each([[{ ok: true }], [[1, 2]]])('responds with JSON to an object or array body a listener sets (%j)', async (body) => {
    const response = await respondWith({ body })

    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toBe('application/json')
    expect(await response.json()).toEqual(body)
  })

  it('responds with JSON to a `bigint` body a listener sets', async () => {
    const response = await respondWith({ body: 42n })

    expect(response.headers.get('content-type')).toBe('application/json')
    expect(await response.text()).toBe('42')
  })

  it('keeps the content type a listener sets with an object body', async () => {
    const response = await respondWith({ body: { ok: true }, headers: { 'content-type': 'application/ld+json' } })

    expect(response.headers.get('content-type')).toBe('application/ld+json')
    expect(await response.text()).toBe('{"ok":true}')
  })

  it('responds with a `Response` a listener sets as the body, over the status and headers it sets', async () => {
    const hooks = createHooks<Record<string, (context: any) => void>>()
    hooks.hook('render:before', (context) => {
      context.event.res.headers.append('set-cookie', 'a=1')
      context.response = {
        statusCode: 201,
        statusMessage: 'From listener',
        headers: { 'x-listener': '1', 'x-shared': 'listener' },
        body: new Response('from response', { status: 203, headers: [['x-shared', 'response'], ['set-cookie', 'b=2']] }),
      }
    })

    const response = await applyLegacyRenderBefore(mockEvent('http://nuxt/'), hooks, page(), (body, init) => new Response(body, init))

    expect(response.status).toBe(203)
    expect(response.statusText).toBe('From listener')
    expect(response.headers.get('x-listener')).toBe('1')
    expect(response.headers.get('x-shared')).toBe('response')
    expect(response.headers.getSetCookie()).toEqual(['a=1', 'b=2'])
    expect(await response.text()).toBe('from response')
  })

  it.each([
    ['an http error', () => new HTTPError({ status: 418, statusText: 'Teapot' }), 418, false],
    ['an error with a v1 status code', () => Object.assign(new Error('gone'), { statusCode: 410 }), 410, false],
    ['a plain error', () => new Error('failed'), 500, true],
  ])('fails the request with %s a listener sets as the body', async (_, body, status, unhandled) => {
    const hooks = createHooks<Record<string, (context: any) => void>>()
    const event = mockEvent('http://nuxt/')
    hooks.hook('render:before', (context) => {
      context.response = { headers: { 'set-cookie': 'a=1' }, body: body() }
    })
    const renderPage = page()

    const error = await applyLegacyRenderBefore(event, hooks, renderPage, (body, init) => new Response(body, init)).catch(error => error)

    expect(renderPage).not.toHaveBeenCalled()
    expect(HTTPError.isError(error)).toBe(true)
    expect(error.status).toBe(status)
    expect(!!error.unhandled).toBe(unhandled)
    expect((event.context as any).nuxt['~response-headers'].getSetCookie()).toEqual(['a=1'])
  })

  it.each([
    ['a `Uint8Array`', () => new TextEncoder().encode('bytes')],
    ['a `Buffer`', () => Buffer.from('bytes')],
    ['a stream', () => new Blob(['bytes']).stream()],
  ])('sends %s body a listener sets as it is', async (_, body) => {
    const response = await respondWith({ body: body() })

    expect(response.headers.has('content-type')).toBe(false)
    expect(await response.text()).toBe('bytes')
  })

  it('renders with the function a listener puts in place of `render`', async () => {
    const hooks = createHooks<Record<string, (context: any) => void>>()
    const event = mockEvent('http://nuxt/')
    const renderPage = vi.fn((_event: unknown) => Promise.resolve(new Response('<html>page</html>', {
      headers: [['content-type', 'text/html'], ['set-cookie', 'a=1'], ['set-cookie', 'b=2']],
    })))
    hooks.hook('render:before', (context) => {
      const render = context.render
      context.render = async (event: unknown) => {
        const rendered = await render(event)
        return { ...rendered, body: rendered.body.replace('page', 'wrapped'), headers: { ...rendered.headers, 'x-wrapped': '1' } }
      }
    })

    const response = await applyLegacyRenderBefore(event, hooks, renderPage, (body, init) => new Response(body, init))

    expect(renderPage).toHaveBeenCalledOnce()
    expect(response.headers.get('x-wrapped')).toBe('1')
    expect(response.headers.getSetCookie()).toEqual(['a=1', 'b=2'])
    expect(await response.text()).toBe('<html>wrapped</html>')
  })

  it.each([204, 304])('responds with no body to a %i page rendered through a replaced `render`', async (status) => {
    const hooks = createHooks<Record<string, (context: any) => void>>()
    hooks.hook('render:before', (context) => {
      const render = context.render
      context.render = async (event: unknown) => ({ ...await render(event), headers: { 'x-wrapped': '1' } })
    })
    const renderPage = () => Promise.resolve(new Response(null, { status, headers: { etag: '"page"' } }))

    const response = await applyLegacyRenderBefore(mockEvent('http://nuxt/'), hooks, renderPage, (body, init) => new Response(body, init))

    expect([response.status, response.headers.get('x-wrapped'), response.body]).toEqual([status, '1', null])
  })

  it.each([204, 304])('responds with no body to a %i a listener sets with a body', async (status) => {
    const response = await respondWith({ statusCode: status, body: 'stale' })

    expect([response.status, response.headers.get('content-type'), response.body]).toEqual([status, null, null])
  })
})

describe('nitro v2 plugin wrapper', () => {
  function runLegacyPlugin (plugin: (nitroApp: any) => void | Promise<void>) {
    const hooks = new HookableCore<Record<string, (...args: any[]) => any>>()
    observeLegacyHooks(hooks)
    const nitroApp = { hooks } as any
    const result = wrapLegacyPlugin(plugin, 'modules/runtime/plugin.ts')(nitroApp)
    return { hooks, nitroApp, result }
  }

  it('hands a v2 plugin a `callHook` that returns a promise, as Nitro v2 did', async () => {
    const listener = vi.fn()
    let called: unknown
    const { hooks } = runLegacyPlugin((nitroApp) => {
      nitroApp.hooks.hook('custom', listener)
      called = nitroApp.hooks.callHook('custom', 1)
    })

    expect(called).toBeInstanceOf(Promise)
    await called
    expect(listener).toHaveBeenCalledWith(1)
    expect(hooks.callHook('custom', 2)).toBeUndefined()
  })

  it('reaches the listeners through a `callHook` a v2 plugin decorates', async () => {
    const listener = vi.fn()
    const decorator = vi.fn()
    let decorated: ((...args: any[]) => Promise<unknown>) | undefined
    const { hooks } = runLegacyPlugin((nitroApp) => {
      nitroApp.hooks.hook('custom', listener)
      const original = nitroApp.hooks.callHook.bind(nitroApp.hooks)
      nitroApp.hooks.callHook = (...args: any[]) => {
        decorator(...args)
        return original(...args)
      }
      decorated = nitroApp.hooks.callHook
    })

    await decorated!('custom', 1)
    await hooks.callHook('custom', 2)

    expect(decorator.mock.calls).toEqual([['custom', 1], ['custom', 2]])
    expect(listener.mock.calls).toEqual([[1], [2]])
  })

  it('registers and removes listeners on the hooks Nitro runs', async () => {
    const listener = vi.fn()
    let off: (() => void) | undefined
    const { hooks } = runLegacyPlugin((nitroApp) => {
      off = nitroApp.hooks.hook('beforeResponse', listener)
    })

    expect(hasLegacyHookListener(hooks, 'beforeResponse')).toBe(true)
    await hooks.callHook('beforeResponse')
    expect(listener).toHaveBeenCalledTimes(1)

    off!()
    expect(hasLegacyHookListener(hooks, 'beforeResponse')).toBe(false)
  })

  it('runs a `render:before` listener a v2 plugin registers', async () => {
    const { hooks } = runLegacyPlugin((nitroApp) => {
      nitroApp.hooks.hook('render:before', (context: any) => {
        context.response = { body: '<html>from plugin</html>', statusCode: 202 }
      })
    })

    expect(hasLegacyHookListener(hooks, 'render:before')).toBe(true)
    const response = await applyLegacyRenderBefore(mockEvent('http://nuxt/'), hooks, () => Promise.resolve(new Response('page')), (body, init) => new Response(body, init))
    expect(response.status).toBe(202)
    expect(await response.text()).toBe('<html>from plugin</html>')
  })

  it('writes to the app Nitro runs and keeps the result of an async plugin', () => {
    const ready = Promise.resolve()
    const { nitroApp, result } = runLegacyPlugin((app) => {
      app.custom = true
      return ready
    })

    expect(nitroApp.custom).toBe(true)
    expect(result).toBe(ready)
  })

  it('reports once per plugin a `close` listener registered while prerendering, and still registers it', async () => {
    vi.stubGlobal('__TEST_PRERENDER__', true)
    const report = vi.spyOn(serverDiagnostics, 'NUXT_E8017').mockImplementation(() => ({}) as any)
    onTestFinished(() => {
      vi.unstubAllGlobals()
      report.mockRestore()
    })
    const listener = vi.fn()
    const { hooks, nitroApp } = runLegacyPlugin((app) => {
      app.hooks.hook('close', listener)
      app.hooks.hook('close', listener)
      app.hooks.hook('render:html', () => {})
    })
    wrapLegacyPlugin((app) => {
      app.hooks.hook('close', listener)
    }, 'server/plugins/other.ts')(nitroApp)

    expect(report.mock.calls).toEqual([[{ plugin: 'modules/runtime/plugin.ts' }], [{ plugin: 'server/plugins/other.ts' }]])
    await hooks.callHook('close')
    expect(listener).toHaveBeenCalledTimes(3)
  })

  it('registers listeners while prerendering after a plugin replaces `hook` with one calling the previous `hook`', async () => {
    vi.stubGlobal('__TEST_PRERENDER__', true)
    const report = vi.spyOn(serverDiagnostics, 'NUXT_E8017').mockImplementation(() => ({}) as any)
    onTestFinished(() => {
      vi.unstubAllGlobals()
      report.mockRestore()
    })
    const listener = vi.fn()
    const registered: string[] = []
    const { hooks } = runLegacyPlugin((app) => {
      const hook = app.hooks.hook
      app.hooks.hook = (name: string, fn: any) => {
        registered.push(name)
        return hook(name, fn)
      }
      app.hooks.hook('render:html', listener)
      app.hooks.hook('close', listener)
    })

    expect(registered).toEqual(['render:html', 'close'])
    expect(report).toHaveBeenCalledOnce()
    await hooks.callHook('render:html')
    await hooks.callHook('close')
    expect(listener).toHaveBeenCalledTimes(2)
  })

  it('reports a `close` listener an async plugin registers while prerendering, but not one registered after its setup', async () => {
    vi.stubGlobal('__TEST_PRERENDER__', true)
    const report = vi.spyOn(serverDiagnostics, 'NUXT_E8017').mockImplementation(() => ({}) as any)
    onTestFinished(() => {
      vi.unstubAllGlobals()
      report.mockRestore()
    })
    let app: any
    const { nitroApp, result } = runLegacyPlugin(async (legacyApp) => {
      await Promise.resolve()
      legacyApp.hooks.hook('close', () => {})
    })
    await result
    await wrapLegacyPlugin(async (legacyApp) => {
      app = legacyApp
      await Promise.resolve()
    }, 'server/plugins/other.ts')(nitroApp)
    app.hooks.hook('close', () => {})

    expect(report.mock.calls).toEqual([[{ plugin: 'modules/runtime/plugin.ts' }]])
  })

  it('does not report a `close` listener outside the prerenderer', () => {
    const report = vi.spyOn(serverDiagnostics, 'NUXT_E8017').mockImplementation(() => ({}) as any)
    onTestFinished(() => { report.mockRestore() })
    runLegacyPlugin((nitroApp) => {
      nitroApp.hooks.hook('close', () => {})
    })

    expect(report).not.toHaveBeenCalled()
  })
})
