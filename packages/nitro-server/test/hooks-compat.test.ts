import { mkdtemp, writeFile } from 'node:fs/promises'
import { openAsBlob } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { HookableCore, createHooks } from 'hookable'
import { H3, mockEvent } from 'nitro/h3'

import { serverDiagnostics } from '../src/runtime/diagnostics.ts'
import { hasLegacyHookListener, observeLegacyHooks } from '../src/runtime/compat/hook-registry.ts'
import { markStreamedResponse } from '../src/runtime/compat/render-response.ts'
import { applyLegacyRenderBefore } from '../src/runtime/compat/render-before.ts'
import { prepareLegacyEvent } from '../src/runtime/compat/event.ts'
import type { LegacyH3Event } from '../src/runtime/compat/h3-v1.ts'
import plugin from '../src/runtime/compat/hooks-plugin.ts'

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
})
