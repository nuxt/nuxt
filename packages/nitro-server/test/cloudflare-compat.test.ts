import { describe, expect, it, vi } from 'vitest'
import { mockEvent } from 'nitro/h3'

import { decorateLegacyEvent } from '../src/runtime/compat/decorate.ts'

vi.mock('#nuxt-compat/flags', () => ({ legacyCompat: true, cloudflareCompat: true }))
vi.mock('nitro/app', () => ({
  getRouteRules: vi.fn(() => ({ routeRules: {}, routeRuleMiddleware: [] })),
}))

const env = { DB: {} }
const context = { waitUntil: () => {} }

function cloudflareEvent (url: string) {
  const event = mockEvent(url)
  ;(event.req as any).runtime = { name: 'cloudflare', cloudflare: { env, context } }
  return event
}

describe('v2 cloudflare context', () => {
  it('exposes the request runtime as `event.context.cloudflare`', () => {
    const event = decorateLegacyEvent(cloudflareEvent('http://nuxt/api/test'))

    expect((event.context as any).cloudflare).toEqual({ request: event.req, env, context })
  })

  it('falls back to the worker env for a sub-request without a runtime', () => {
    ;(globalThis as any).__env__ = env
    try {
      const event = decorateLegacyEvent(mockEvent('http://nuxt/api/inner'))

      expect((event.context as any).cloudflare).toEqual({ request: event.req, env, context: undefined })
    } finally {
      delete (globalThis as any).__env__
    }
  })

  it('exposes nothing when there is no env to bridge', () => {
    const event = decorateLegacyEvent(mockEvent('http://nuxt/api/test'))

    expect((event.context as any).cloudflare).toBeUndefined()
    expect('cloudflare' in event.context).toBe(true)
  })

  it('does not clobber a `cloudflare` slot the handler chain already set', () => {
    const event = cloudflareEvent('http://nuxt/api/test')
    ;(event.context as any).cloudflare = { own: true }
    decorateLegacyEvent(event)

    expect((event.context as any).cloudflare).toEqual({ own: true })
  })

  it('accepts a value assigned after decoration', () => {
    const event = decorateLegacyEvent(cloudflareEvent('http://nuxt/api/test'))
    ;(event.context as any).cloudflare = { own: true }

    expect((event.context as any).cloudflare).toEqual({ own: true })
  })
})
