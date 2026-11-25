import { describe, expect, it } from 'vitest'
import type { NuxtRendererOptions, RendererEvent } from 'nuxt/internal/renderer/runtime'
import type { RendererContext } from 'vue-bundle-renderer/runtime'
import { withQuery } from 'ufo'

import * as nuxt4 from '../src/runtime/host/nuxt4.ts'

const options = { createResponse: (body, init) => new Response(body, init) } as NuxtRendererOptions

function event (headers: Record<string, string> = {}): RendererEvent {
  return { req: new Request('http://localhost/'), url: new URL('http://localhost/'), res: { headers: new Headers(headers) }, context: {} } as unknown as RendererEvent
}

describe('nuxt 4 renderer host', () => {
  it('sends the error to render as plain query parameters, addressed by path', () => {
    expect(nuxt4.errorPageQuery({ status: 404, statusText: 'Not Found', url: 'http://localhost/missing?a=1#top', data: { id: 1 } })).toEqual({
      status: 404,
      statusText: 'Not Found',
      url: '/missing?a=1#top',
      data: '{"id":1}',
    })
  })

  it('leaves out error data that cannot be serialised', () => {
    const data: Record<string, unknown> = {}
    data.self = data
    const query = nuxt4.errorPageQuery({ status: 500, data })
    expect(withQuery('/__nuxt_error', query)).toBe('/__nuxt_error?status=500&url=%2F')
  })

  it('sends the cause of a development error as JSON', () => {
    expect(nuxt4.errorPageQuery({ status: 500 }, { message: 'inner' } as never)).toMatchObject({ cause: '{"message":"inner"}' })
  })

  it('turns a response queued by the app into a `Response`', () => {
    const response = nuxt4.toRenderResponse(options, { body: '', statusCode: 302, headers: { location: '/login' } })
    expect(response.status).toBe(302)
    expect(response.headers.get('location')).toBe('/login')

    const passthrough = new Response('ok')
    expect(nuxt4.toRenderResponse(options, passthrough)).toBe(passthrough)
  })

  it('returns a queued response with the headers already set on the event', async () => {
    const response = nuxt4.returnRenderResponse(
      options,
      event({ 'set-cookie': 'a=1', 'x-event': '1' }),
      new Response('body', { status: 201, headers: { 'set-cookie': 'b=2', 'x-render': '2' } }),
    )
    expect(response.status).toBe(201)
    expect(response.headers.get('x-event')).toBe('1')
    expect(response.headers.get('x-render')).toBe('2')
    expect(response.headers.getSetCookie()).toEqual(['a=1', 'b=2'])
    expect(await response.text()).toBe('body')
  })

  it('adds the dev client CSS of a request to the `@vite/client` entry of the manifest', () => {
    const request = event()
    request.context.nuxt = { '~devClientCss': ['/assets/main.css'] }
    let manifest: Record<string, unknown> | undefined
    const rendererContext = {
      manifest: { '@vite/client': { file: '@vite/client', isEntry: true } },
      updateManifest: (next: Record<string, unknown>) => { manifest = next },
    } as unknown as RendererContext

    nuxt4.patchDevClientCss(request, rendererContext)
    expect(manifest?.['@vite/client']).toMatchObject({ css: ['/assets/main.css'] })
  })

  it('keeps the headers of a failed render on the request, not on the error', async () => {
    const failed = event({ 'set-cookie': 'session=1' })
    const error = new Error('failed')
    const renderer = { fetch: () => Promise.reject(error) }

    await expect(nuxt4.renderPage(renderer, failed)).rejects.toBe(error)
    expect(error).not.toHaveProperty('headers')
    expect((failed.context as { nuxt?: Record<string, unknown> }).nuxt?.['~response-headers']).toBe(failed.res.headers)
  })

  it('adds the h3 v1 status keys to a JSON error body', () => {
    expect(nuxt4.toJSONErrorBody({ error: true, status: 404, statusText: 'Not Found', message: 'Not Found' })).toEqual({
      error: true,
      status: 404,
      statusText: 'Not Found',
      statusCode: 404,
      statusMessage: 'Not Found',
      message: 'Not Found',
    })
    expect(nuxt4.toJSONErrorBody({ error: true, status: 500, unhandled: true })).toEqual({ error: true, status: 500, statusCode: 500, unhandled: true })
    expect(nuxt4.toJSONErrorBody('Redirecting...')).toBe('Redirecting...')
  })

  it('reports a route without an `ssr` rule as opted out of rendering', () => {
    expect(nuxt4.withRouteRuleDefaults({})).toEqual({ ssr: false })
    expect(nuxt4.withRouteRuleDefaults({ ssr: true, noScripts: true })).toEqual({ ssr: true, noScripts: true })
  })
})
