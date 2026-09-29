import { describe, expect, it, vi } from 'vitest'

import { useAppConfig } from '../src/server/index'
import type { RequestEvent } from '../src/server/index'

vi.mock('nuxt/internal/server-app-config', () => ({ default: { theme: { color: 'green' } } }))

function event (): RequestEvent {
  const request = new Request('https://nuxt.com/')
  return { req: request, url: new URL(request.url), res: { headers: new Headers() }, context: {} }
}

describe('`useAppConfig`', () => {
  it('reads the app config the build provides, frozen when shared', () => {
    const shared = useAppConfig()
    expect(shared).toEqual({ theme: { color: 'green' } })
    expect(useAppConfig()).toBe(shared)
    expect(Object.isFrozen((shared as { theme: object }).theme)).toBe(true)
  })

  it('returns a copy per request, which the request may change', () => {
    const e = event()
    const config = useAppConfig(e) as { theme: { color: string } }
    config.theme.color = 'red'

    expect(useAppConfig(e)).toBe(config)
    expect(e.context.nuxt?.appConfig).toBe(config)
    expect(useAppConfig(event())).toEqual({ theme: { color: 'green' } })
    expect(useAppConfig()).toEqual({ theme: { color: 'green' } })
  })
})
