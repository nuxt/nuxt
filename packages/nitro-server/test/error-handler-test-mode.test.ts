import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { H3Event } from 'nitro/h3'

const serverFetch = vi.hoisted(() => vi.fn())
const observeDevError = vi.hoisted(() => vi.fn())
const overlay = vi.hoisted(() => vi.fn())

vi.mock('nitro', () => ({ serverFetch }))
vi.mock('../src/runtime/utils/error-channel', () => ({
  observeDevError,
  serializeErrorCause: () => undefined,
}))

const { default: errorHandler } = await import('../src/runtime/handlers/error.ts')

async function renderHtmlError () {
  const event = {
    url: new URL('http://localhost/boom'),
    req: { url: 'http://localhost/boom', method: 'GET', headers: new Headers({ accept: 'text/html' }) },
    res: { headers: new Headers() },
    context: {},
  } as unknown as H3Event
  const res = await errorHandler(new Error('boom') as any, event, {
    defaultHandler: () => Promise.resolve({ status: 500, statusText: 'Server Error', body: {}, headers: new Headers() }),
  } as any) as Response
  return { html: await res.text(), publish: observeDevError.mock.lastCall?.[2]?.publish }
}

describe('dev error handler under test', () => {
  beforeEach(() => {
    vi.stubGlobal('__TEST_DEV__', true)
    serverFetch.mockReset()
    serverFetch.mockResolvedValue(new Response('<html>page</html>'))
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
