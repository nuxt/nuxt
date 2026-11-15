import type { IncomingMessage, ServerResponse } from 'node:http'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createEvent } from 'h3'

const nuxtApp: { ssrContext?: { event: unknown } } = {}

vi.mock('../src/app/nuxt', () => ({ useNuxtApp: () => nuxtApp }))

const { useRequestHeader, useRequestHeaders } = await import('../src/app/composables/ssr')

const events = {
  'an h3 event': () => createEvent({ headers: { 'cookie': 'a=1', 'x-custom': 'value' } } as unknown as IncomingMessage, {} as ServerResponse),
  'a web-standard event': () => ({
    req: new Request('http://localhost/', { headers: { 'cookie': 'a=1', 'x-custom': 'value' } }),
    url: new URL('http://localhost/'),
    res: { headers: new Headers() },
    context: {},
  }),
}

describe.each(Object.entries(events))('request headers on %s', (_, createRequestEvent) => {
  beforeEach(() => {
    vi.stubGlobal('__TEST_SERVER__', true)
    nuxtApp.ssrContext = { event: createRequestEvent() }
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    delete nuxtApp.ssrContext
  })

  it('should read a single header', () => {
    expect(useRequestHeader('X-Custom')).toBe('value')
    expect(useRequestHeader('x-missing')).toBeUndefined()
  })

  it('should read every header', () => {
    expect(useRequestHeaders()).toEqual({ 'cookie': 'a=1', 'x-custom': 'value' })
  })

  it('should read the headers it is given', () => {
    expect(useRequestHeaders(['Cookie', 'x-missing'])).toEqual({ cookie: 'a=1' })
  })
})
