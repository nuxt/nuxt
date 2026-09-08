import { describe, expect, it } from 'vitest'
import { mockEvent } from 'nitro/h3'

import { applyLegacyRenderResponse } from '../src/runtime/compat/render-response.ts'

function createHooks (handler?: (response: any, context: any) => void) {
  return {
    _hooks: handler ? { 'render:response': [handler] } : {},
    callHook: (_name: string, ...args: any[]) => handler?.(args[0], args[1]),
  }
}

describe('legacy `render:response` hook', () => {
  it('is skipped when nothing is listening', async () => {
    const event = mockEvent('http://nuxt/')
    expect(await applyLegacyRenderResponse(event, createHooks(), '<html></html>')).toBe('<html></html>')
  })

  it('applies headers set on the event and on the payload', async () => {
    const event = mockEvent('http://nuxt/')
    event.res.headers.set('content-type', 'text/html')

    await applyLegacyRenderResponse(event, createHooks((response, { event }) => {
      event.res.headers.set('content-security-policy', `script-src 'nonce-abc'`)
      response.headers['x-from-payload'] = 'yes'
    }), '<html></html>')

    expect(event.res.headers.get('content-security-policy')).toBe(`script-src 'nonce-abc'`)
    expect(event.res.headers.get('x-from-payload')).toBe('yes')
    expect(event.res.headers.get('content-type')).toBe('text/html')
  })

  it('deletes a header removed from the payload', async () => {
    const event = mockEvent('http://nuxt/')
    event.res.headers.set('x-powered-by', 'Nuxt')

    await applyLegacyRenderResponse(event, createHooks((response) => {
      delete response.headers['x-powered-by']
    }), '<html></html>')

    expect(event.res.headers.has('x-powered-by')).toBe(false)
  })

  it('applies a status and body replacement', async () => {
    const event = mockEvent('http://nuxt/')

    const body = await applyLegacyRenderResponse(event, createHooks((response) => {
      response.statusCode = 503
      response.statusMessage = 'Unavailable'
      response.body = '<html>replaced</html>'
    }), '<html></html>')

    expect(body).toBe('<html>replaced</html>')
    expect(event.res.status).toBe(503)
    expect(event.res.statusText).toBe('Unavailable')
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
