import { describe, expect, it, vi } from 'vitest'

import { serverDiagnostics } from '../src/runtime/diagnostics.ts'
import { observeLegacyHooks } from '../src/runtime/compat/hook-registry.ts'
import { markStreamedResponse } from '../src/runtime/compat/render-response.ts'
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
    const report = vi.spyOn(serverDiagnostics, 'NUXT_E8009').mockImplementation(() => ({}) as any)
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
