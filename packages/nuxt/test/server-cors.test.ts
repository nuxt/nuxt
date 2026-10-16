import { describe, expect, it } from 'vitest'

import { handleCors } from '../src/server/index'
import type { RequestEvent } from '../src/server/index'

function event (method: string, headers: Record<string, string>): RequestEvent {
  const request = new Request('https://nuxt.com/api', { method, headers })
  return { req: request, url: new URL(request.url), res: { headers: new Headers() }, context: {} }
}

const preflight = { 'origin': 'https://nuxt.com', 'access-control-request-method': 'PUT', 'access-control-request-headers': 'x-custom' }

describe('`handleCors`', () => {
  it('allows any origin by default, continuing a request that is not a preflight', () => {
    const e = event('GET', { origin: 'https://nuxt.com' })
    expect(handleCors(e)).toBe(false)
    expect(Object.fromEntries(e.res.headers)).toEqual({
      'access-control-allow-origin': '*',
      'access-control-expose-headers': '*',
    })
  })

  it('answers a preflight with a 204, reflecting the requested headers', () => {
    const e = event('OPTIONS', preflight)
    const response = handleCors(e)
    expect(response && response.status).toBe(204)
    expect(Object.fromEntries(e.res.headers)).toEqual({
      'access-control-allow-origin': '*',
      'access-control-allow-methods': '*',
      'access-control-allow-headers': 'x-custom',
      'vary': 'access-control-request-headers',
    })
  })

  it('reflects an allowed origin and the requested method for a credentialed preflight', () => {
    const e = event('OPTIONS', preflight)
    handleCors(e, { origin: ['https://nuxt.com'], credentials: true, maxAge: '600' })
    expect(Object.fromEntries(e.res.headers)).toEqual({
      'access-control-allow-origin': 'https://nuxt.com',
      'access-control-allow-credentials': 'true',
      'access-control-allow-methods': 'PUT',
      'access-control-allow-headers': 'x-custom',
      'access-control-max-age': '600',
      'vary': 'origin, access-control-request-method, access-control-request-headers',
    })
  })

  it('allows no origin that fails the check, and varies on it', () => {
    const e = event('GET', { origin: 'https://nuxt.com.evil.test' })
    handleCors(e, { origin: [/^https:\/\/nuxt\.com$/], exposeHeaders: ['x-exposed'] })
    expect(Object.fromEntries(e.res.headers)).toEqual({
      'vary': 'origin',
      'access-control-expose-headers': 'x-exposed',
    })
  })

  it('treats an OPTIONS request without a requested method as an ordinary request', () => {
    expect(handleCors(event('OPTIONS', { origin: 'https://nuxt.com' }))).toBe(false)
  })
})
