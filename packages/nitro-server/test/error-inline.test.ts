import { describe, expect, it, vi } from 'vitest'
import { IncomingMessage, ServerResponse } from 'node:http'
import { Socket } from 'node:net'
import { createError, createEvent } from 'h3'

const localFetch = vi.hoisted(() => vi.fn())

vi.mock('nitropack/runtime', () => ({
  useNitroApp: () => ({ localFetch }),
  useRuntimeConfig: () => ({ app: { baseURL: '/' } }),
}))
vi.mock('nuxt/internal/renderer-config', () => ({ NUXT_INLINE_ERROR_RENDERING: true }))
vi.mock('h3', async importOriginal => ({
  ...await importOriginal<typeof import('h3')>(),
  send: (_event: unknown, body: string) => body,
}))

const { default: errorHandler } = await import('../src/runtime/handlers/error.ts')

describe('error handler with inline error rendering', () => {
  it('returns JSON, even for a page request', async () => {
    const req = new IncomingMessage(new Socket())
    req.method = 'GET'
    req.url = '/admin'
    req.headers = { host: 'localhost', accept: 'text/html' }
    const res = new ServerResponse(req)
    const body = await errorHandler(createError({ statusCode: 401 }), createEvent(req, res), {
      defaultHandler: () => Promise.resolve({ status: 401, statusText: 'Unauthorized', body: { statusCode: 401 }, headers: { 'content-type': 'application/json' } }),
    } as any)

    expect(JSON.parse(body as unknown as string)).toEqual({ statusCode: 401 })
    expect(res.getHeader('vary')).toBeUndefined()
    expect(localFetch).not.toHaveBeenCalled()
  })
})
