import { describe, expect, it, vi } from 'vitest'
import { HTTPError } from 'nitro/h3'
import type { H3Event } from 'nitro/h3'

const serverFetch = vi.hoisted(() => vi.fn())

vi.mock('nitro', () => ({ serverFetch }))
vi.mock('nuxt/internal/renderer-config', () => ({ NUXT_INLINE_ERROR_RENDERING: true }))

const { default: errorHandler } = await import('../src/runtime/handlers/error.ts')

describe('error handler with inline error rendering', () => {
  it('returns JSON, even for a page request', async () => {
    const event = {
      url: new URL('http://localhost/admin'),
      req: { url: 'http://localhost/admin', method: 'GET', headers: new Headers({ accept: 'text/html' }) },
      res: { headers: new Headers() },
      context: {},
    } as unknown as H3Event
    const res = await errorHandler(new HTTPError({ status: 401 }) as any, event, {
      defaultHandler: () => Promise.resolve({ status: 401, statusText: 'Unauthorized', body: { status: 401 }, headers: new Headers() }),
    } as any) as Response

    expect(await res.json()).toEqual({ status: 401 })
    expect(res.headers.has('vary')).toBe(false)
    expect(serverFetch).not.toHaveBeenCalled()
  })
})
