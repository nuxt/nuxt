import { describe, expect, it, vi } from 'vitest'
import { HTTPResponse, mockEvent } from 'nitro/h3'

vi.mock('nitro/cache', () => ({ defineCachedHandler: (handler: unknown) => handler }))
vi.mock('../src/runtime/utils/app-config.ts', () => ({}))

const { cachedEventHandler, defineCachedEventHandler } = await import('../src/runtime/compat/nitro-v2.ts')

describe('nitro v2 `defineCachedEventHandler`', () => {
  it.each([defineCachedEventHandler, cachedEventHandler])('answers a handler that returns `null` with no content', async (define) => {
    const response = await (define(() => null) as (event: unknown) => Promise<unknown>)(mockEvent('http://nuxt/api/_nuxt_icon/custom.json?icons=nope'))

    expect(response).toBeInstanceOf(HTTPResponse)
    expect((response as HTTPResponse).status).toBe(204)
  })

  it('passes on what any other handler returns', async () => {
    const data = { icons: {} }
    expect(await (defineCachedEventHandler(() => data) as (event: unknown) => Promise<unknown>)(mockEvent('http://nuxt/api/icons'))).toBe(data)
  })
})
