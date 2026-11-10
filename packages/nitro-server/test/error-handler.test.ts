import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { IncomingMessage, ServerResponse } from 'node:http'
import { Socket } from 'node:net'
import { createError, createEvent } from 'h3'

const localFetch = vi.hoisted(() => vi.fn())
const observeDevError = vi.hoisted(() => vi.fn())
const flags = vi.hoisted(() => ({ inlineErrors: false }))

vi.mock('nitropack/runtime', () => ({
  useNitroApp: () => ({ localFetch }),
  useRuntimeConfig: () => ({ app: { baseURL: '/' } }),
}))
vi.mock('#internal/nuxt/error-channel', () => ({
  observeDevError,
  serializeErrorCause: () => undefined,
}))
vi.mock('nuxt/internal/renderer-config', () => ({
  get NUXT_INLINE_ERROR_RENDERING () {
    return flags.inlineErrors
  },
}))
vi.mock('h3', async importOriginal => ({
  ...await importOriginal<typeof import('h3')>(),
  send: (_event: unknown, body: string) => body,
}))

const { default: errorHandler } = await import('../src/runtime/handlers/error.ts')

function handle (error: Error, accept: string, defaults: { status?: number, statusText?: string, body?: unknown, headers?: Record<string, string> } = {}, path = '/unknown') {
  const req = new IncomingMessage(new Socket())
  req.method = 'GET'
  req.url = path
  req.headers = { host: 'localhost', accept }
  const res = new ServerResponse(req)
  const body = errorHandler(error as any, createEvent(req, res), {
    defaultHandler: () => Promise.resolve({
      status: defaults.status ?? 404,
      statusText: defaults.statusText ?? 'Not Found',
      body: defaults.body ?? {},
      headers: defaults.headers ?? {},
    }),
  } as any) as Promise<unknown>
  return { res, body }
}

beforeEach(() => {
  flags.inlineErrors = false
  localFetch.mockReset()
  localFetch.mockResolvedValue(new Response('<html></html>'))
  observeDevError.mockReset()
  observeDevError.mockResolvedValue(undefined)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('error handler with inline error rendering', () => {
  it('returns JSON, even for a page request', async () => {
    flags.inlineErrors = true
    const { res, body } = handle(createError({ statusCode: 401 }), 'text/html', { status: 401, statusText: 'Unauthorized', body: { statusCode: 401 }, headers: { 'content-type': 'application/json' } }, '/admin')

    expect(JSON.parse(await body as string)).toEqual({ statusCode: 401 })
    expect(res.getHeader('vary')).toBeUndefined()
    expect(localFetch).not.toHaveBeenCalled()
  })
})

describe('dev error handler', () => {
  class ForeignH3Error extends Error {
    static __h3_error__ = true
    statusCode: number
    constructor (statusCode: number) {
      super('foreign')
      this.statusCode = statusCode
    }
  }

  async function observedAs (error: Error) {
    await handle(error, 'application/json').body
    return observeDevError.mock.lastCall?.[2]
  }

  const overlay = vi.fn()

  async function renderHtmlError () {
    localFetch.mockResolvedValue(new Response('<html>page</html>'))
    overlay.mockReset()
    overlay.mockResolvedValue('<html>overlay</html>')
    observeDevError.mockResolvedValue({ overlay, page: () => Promise.resolve('<html>report</html>') })
    const html = await handle(new Error('boom'), 'text/html', { status: 500, statusText: 'Server Error', body: { url: 'http://localhost/boom' } }, '/boom').body
    return { html, publish: observeDevError.mock.lastCall?.[2]?.publish }
  }

  beforeEach(() => {
    vi.stubGlobal('__TEST_DEV__', true)
  })

  it('treats a client error from another copy of h3 as expected', async () => {
    expect(await observedAs(new ForeignH3Error(404))).toMatchObject({ expected: true, print: false })
  })

  it('does not treat a server error from another copy of h3 as expected', async () => {
    expect(await observedAs(new ForeignH3Error(500))).toMatchObject({ expected: false })
  })

  it('publishes the report and overlays the page outside of tests', async () => {
    vi.stubGlobal('__TEST_TEST__', false)
    expect(await renderHtmlError()).toEqual({ html: '<html>overlay</html>', publish: true })
  })

  it('neither publishes the report nor overlays the page when `import.meta.test` is set', async () => {
    vi.stubGlobal('__TEST_TEST__', true)
    expect(await renderHtmlError()).toEqual({ html: '<html>page</html>', publish: false })
    expect(overlay).not.toHaveBeenCalled()
  })
})
