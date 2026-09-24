import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { IncomingMessage, ServerResponse } from 'node:http'
import { Socket } from 'node:net'
import { createEvent } from 'h3'

const localFetch = vi.hoisted(() => vi.fn())
const observeDevError = vi.hoisted(() => vi.fn())
const overlay = vi.hoisted(() => vi.fn())

vi.mock('nitropack/runtime', () => ({
  useNitroApp: () => ({ localFetch }),
  useRuntimeConfig: () => ({ app: { baseURL: '/' } }),
}))
vi.mock('#internal/nuxt/error-channel', () => ({
  observeDevError,
  serializeErrorCause: () => undefined,
}))
vi.mock('h3', async importOriginal => ({
  ...await importOriginal<typeof import('h3')>(),
  send: (_event: unknown, body: string) => body,
}))

const { default: errorHandler } = await import('../src/runtime/handlers/error.ts')

async function renderHtmlError () {
  const req = new IncomingMessage(new Socket())
  req.method = 'GET'
  req.url = '/boom'
  req.headers = { host: 'localhost', accept: 'text/html' }
  const event = createEvent(req, new ServerResponse(req))
  const html = await errorHandler(new Error('boom') as any, event, {
    defaultHandler: () => Promise.resolve({ status: 500, statusText: 'Server Error', body: { url: 'http://localhost/boom' }, headers: {} }),
  } as any)
  return { html, publish: observeDevError.mock.lastCall?.[2]?.publish }
}

describe('dev error handler under test', () => {
  beforeEach(() => {
    vi.stubGlobal('__TEST_DEV__', true)
    localFetch.mockReset()
    localFetch.mockResolvedValue(new Response('<html>page</html>'))
    overlay.mockReset()
    overlay.mockResolvedValue('<html>overlay</html>')
    observeDevError.mockReset()
    observeDevError.mockResolvedValue({ overlay, page: () => Promise.resolve('<html>report</html>') })
  })
  afterEach(() => {
    vi.unstubAllGlobals()
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
