import { describe, expect, it, vi } from 'vitest'

vi.mock('nuxt/internal/renderer-config', async importOriginal => ({
  ...await importOriginal<typeof import('nuxt/internal/renderer-config')>(),
  appPayloadFileName: 'route data.json',
}))

const { payloadRequestToRoute, routeToPayloadURL } = await import('../../src/runtime/server/renderer/url.ts')
const { toPageMatcherPath } = await import('../../src/runtime/server/renderer/early-404.ts')

describe('encoded custom payloadFileName', () => {
  it('matches and strips percent-encoded payload filenames consistently', () => {
    const payloadURL = routeToPayloadURL('/', '/known', 'b1')
    expect(payloadURL).toBe('/known/route%20data.json?_b=b1')
    expect(payloadRequestToRoute(payloadURL)).toBe('/known')
    expect(toPageMatcherPath('/known/route%20data.json')).toBe('/known')
  })
})
