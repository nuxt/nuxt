import { inspect } from 'node:util'
import { describe, expect, it } from 'vitest'
import { mockEvent } from 'nitro/h3'
import { FastResponse } from 'srvx'

import { applyLegacyRenderResponse, applyLegacyRenderResponseTo, isStreamedResponse, markStreamedResponse, rememberRenderBody, toRenderBody } from '../src/runtime/compat/render-response.ts'

function createHooks (handler?: (response: any, context: any) => void) {
  return {
    _hooks: handler ? { 'render:response': [handler] } : {},
    callHook: (_name: string, ...args: any[]) => handler?.(args[0], args[1]),
  }
}

describe('legacy `render:response` hook', () => {
  it('keeps the encoded body when nothing replaces it', async () => {
    const event = mockEvent('http://nuxt/')
    expect(await applyLegacyRenderResponse(event, createHooks(), toRenderBody('<html></html>'))).toBeUndefined()
  })

  it('exposes the rendered html to the listener', async () => {
    const event = mockEvent('http://nuxt/')
    let seen: string | undefined
    await applyLegacyRenderResponse(event, createHooks((response) => { seen = response.body }), toRenderBody(['<html>', '</html>']))
    expect(seen).toBe('<html></html>')
  })

  it('applies headers set on the event and on the payload', async () => {
    const event = mockEvent('http://nuxt/')
    event.res.headers.set('content-type', 'text/html')

    await applyLegacyRenderResponse(event, createHooks((response, { event }) => {
      event.res.headers.set('content-security-policy', `script-src 'nonce-abc'`)
      response.headers['x-from-payload'] = 'yes'
    }), toRenderBody('<html></html>'))

    expect(event.res.headers.get('content-security-policy')).toBe(`script-src 'nonce-abc'`)
    expect(event.res.headers.get('x-from-payload')).toBe('yes')
    expect(event.res.headers.get('content-type')).toBe('text/html')
  })

  it('deletes a header removed from the payload', async () => {
    const event = mockEvent('http://nuxt/')
    event.res.headers.set('x-powered-by', 'Nuxt')

    await applyLegacyRenderResponse(event, createHooks((response) => {
      delete response.headers['x-powered-by']
    }), toRenderBody('<html></html>'))

    expect(event.res.headers.has('x-powered-by')).toBe(false)
  })

  it('keeps a header removed from the event', async () => {
    const event = mockEvent('http://nuxt/')
    event.res.headers.set('x-frame-options', 'DENY')

    await applyLegacyRenderResponse(event, createHooks((_response, { event }) => {
      event.res.headers.delete('x-frame-options')
    }), toRenderBody('<html></html>'))

    expect(event.res.headers.has('x-frame-options')).toBe(false)
  })

  it('reads headers set on the event after the hook was called', async () => {
    const event = mockEvent('http://nuxt/')
    event.res.headers.set('x-frame-options', 'DENY')

    await applyLegacyRenderResponse(event, createHooks((response, { event }) => {
      event.res.headers.set('x-frame-options', 'SAMEORIGIN')
      event.res.headers.set('x-added', 'yes')
      for (const [name, value] of Object.entries<string>(response.headers)) {
        event.res.headers.set(name, value)
      }
      expect(response.headers['X-Added']).toBe('yes')
    }), toRenderBody('<html></html>'))

    expect(event.res.headers.get('x-frame-options')).toBe('SAMEORIGIN')
  })

  it('leaves `set-cookie` out of the payload headers', async () => {
    const event = mockEvent('http://nuxt/')
    event.res.headers.set('content-type', 'text/html')
    event.res.headers.append('set-cookie', 'a=1')
    event.res.headers.append('set-cookie', 'b=2')

    await applyLegacyRenderResponse(event, createHooks((response, { event }) => {
      expect({ ...response.headers }).toEqual({ 'content-type': 'text/html' })
      for (const [name, value] of Object.entries<string>(response.headers)) {
        event.res.headers.set(name, value)
      }
    }), toRenderBody('<html></html>'))

    expect(event.res.headers.getSetCookie()).toEqual(['a=1', 'b=2'])
  })

  it('shows the payload headers when inspected', async () => {
    const event = mockEvent('http://nuxt/')
    event.res.headers.set('content-type', 'text/html')
    event.res.headers.set('set-cookie', 'a=1')

    let inspected: string | undefined
    await applyLegacyRenderResponse(event, createHooks((response) => {
      response.headers['x-render-response'] = 'yes'
      delete response.headers['content-type']
      inspected = inspect(response.headers)
    }), toRenderBody('<html></html>'))

    expect(inspected).toBe(`{ 'x-render-response': 'yes' }`)
  })

  it('applies headers from a replaced payload record', async () => {
    const event = mockEvent('http://nuxt/')
    event.res.headers.set('content-type', 'text/html')

    await applyLegacyRenderResponse(event, createHooks((response) => {
      response.headers = { 'x-replaced': 'yes' }
    }), toRenderBody('<html></html>'))

    expect(event.res.headers.get('x-replaced')).toBe('yes')
    expect(event.res.headers.get('content-type')).toBe('text/html')
  })

  it('applies a status and body replacement', async () => {
    const event = mockEvent('http://nuxt/')

    const body = await applyLegacyRenderResponse(event, createHooks((response) => {
      response.statusCode = 503
      response.statusMessage = 'Unavailable'
      response.body = '<html>replaced</html>'
    }), toRenderBody('<html></html>'))

    expect(body).toBe('<html>replaced</html>')
    expect(event.res.status).toBe(503)
    expect(event.res.statusText).toBe('Unavailable')
  })

  it('offers each listener the body set by the previous one', async () => {
    const event = mockEvent('http://nuxt/')
    const hooks = {
      callHook (_name: string, response: { body: string }) {
        response.body = response.body.replace('</html>', '<!--first--></html>')
        response.body = response.body.replace('</html>', '<!--second--></html>')
      },
    }

    expect(await applyLegacyRenderResponse(event, hooks, toRenderBody('<html></html>'))).toBe('<html><!--first--><!--second--></html>')
  })

  it('ignores a body replacement once the response is streaming', async () => {
    const event = mockEvent('http://nuxt/')

    const body = await applyLegacyRenderResponse(event, createHooks((response) => {
      response.body = '<html>replaced</html>'
      response.headers['x-streamed'] = 'yes'
    }), undefined)

    expect(body).toBeUndefined()
    expect(event.res.headers.get('x-streamed')).toBe('yes')
  })
})

function createResponse (body: BodyInit | null, init?: ResponseInit) {
  if (typeof body === 'string') {
    const rendered = toRenderBody(body)
    const response = new FastResponse(rendered.bytes, init)
    rememberRenderBody(response, rendered)
    return response
  }
  const response = new FastResponse(body, init)
  if (body instanceof ReadableStream) {
    markStreamedResponse(response)
  }
  return response
}

describe('legacy `render:response` hook on a rendered response', () => {
  it('offers an error page with its own status and headers', async () => {
    const event = mockEvent('http://nuxt/missing')
    event.res.headers.set('x-from-render', 'yes')
    const page = createResponse('<html>error</html>', event.res)
    const headers = new Headers(page.headers)
    headers.set('content-type', 'text/html;charset=utf-8')
    const response = createResponse(page.body, { status: 404, statusText: 'Page Not Found', headers })

    let seen: Record<string, unknown> | undefined
    const result = await applyLegacyRenderResponseTo(event, createHooks((response) => {
      seen = { statusCode: response.statusCode, statusMessage: response.statusMessage, contentType: response.headers['content-type'] }
      response.headers['x-from-payload'] = 'yes'
    }), response, createResponse)

    expect(seen).toEqual({ statusCode: 404, statusMessage: 'Page Not Found', contentType: 'text/html;charset=utf-8' })
    expect(result.status).toBe(404)
    expect(result.statusText).toBe('Page Not Found')
    expect(result.headers.get('x-from-render')).toBe('yes')
    expect(result.headers.get('x-from-payload')).toBe('yes')
    expect(await result.text()).toBe('<html>error</html>')
  })

  it('applies a status and body replacement to a buffered response', async () => {
    const event = mockEvent('http://nuxt/')
    const response = createResponse('<html></html>', event.res)

    const result = await applyLegacyRenderResponseTo(event, createHooks((response) => {
      response.statusCode = 503
      response.statusMessage = 'Unavailable'
      response.body = response.body.replace('</html>', '<!--replaced--></html>')
    }), response, createResponse)

    expect(result.status).toBe(503)
    expect(result.statusText).toBe('Unavailable')
    expect(await result.text()).toBe('<html><!--replaced--></html>')
  })

  it('carries header changes over to a streamed response', async () => {
    const event = mockEvent('http://nuxt/')
    const headers = new Headers({ 'x-powered-by': 'Nuxt' })
    headers.append('set-cookie', 'a=1')
    headers.append('set-cookie', 'b=2')
    const response = createResponse(new Blob(['<html></html>']).stream(), { headers })

    const result = await applyLegacyRenderResponseTo(event, createHooks((response, { event }) => {
      expect(response.body).toBeUndefined()
      delete response.headers['x-powered-by']
      event.res.headers.set('x-from-event', 'yes')
    }), response, createResponse)

    expect(isStreamedResponse(result)).toBe(true)
    expect(result.headers.has('x-powered-by')).toBe(false)
    expect(result.headers.get('x-from-event')).toBe('yes')
    expect(result.headers.getSetCookie()).toEqual(['a=1', 'b=2'])
    expect(await result.text()).toBe('<html></html>')
  })
})
