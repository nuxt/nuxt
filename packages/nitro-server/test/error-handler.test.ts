import { describe, expect, it, vi } from 'vitest'

import errorHandler, { isMissingSourceMapRequestError } from '../src/runtime/handlers/error'

describe('nitro error handler sourcemap guard', () => {
  it('identifies ENOENT errors for sourcemap requests', () => {
    const event = {
      path: '/_nuxt/entry.123.js.map',
      req: { url: '/_nuxt/entry.123.js.map' },
    } as any

    expect(isMissingSourceMapRequestError({ code: 'ENOENT' }, event)).toBe(true)
    expect(isMissingSourceMapRequestError({ cause: { code: 'ENOENT' } }, event)).toBe(true)
    expect(isMissingSourceMapRequestError({ message: "ENOENT: no such file or directory, open '/tmp/entry.js.map'" }, event)).toBe(true)
  })

  it('does not flag non-sourcemap requests', () => {
    const event = {
      path: '/_nuxt/entry.123.js',
      req: { url: '/_nuxt/entry.123.js' },
    } as any

    expect(isMissingSourceMapRequestError({ code: 'ENOENT' }, event)).toBe(false)
  })

  it('returns 404 before invoking default handler for missing sourcemap files', async () => {
    const defaultHandler = vi.fn()
    const event = {
      path: '/_nuxt/entry.123.js.map',
      req: { url: '/_nuxt/entry.123.js.map' },
    } as any

    const res = await errorHandler({ code: 'ENOENT' } as any, event, { defaultHandler } as any)

    expect(res.status).toBe(404)
    expect(defaultHandler).not.toHaveBeenCalled()
  })
})
