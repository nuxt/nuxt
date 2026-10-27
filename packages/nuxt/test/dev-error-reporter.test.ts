import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ErrorReport } from 'my-bad'
import { createDevErrorReporter, setErrorChannelForwarding, useErrorChannel } from '../src/runtime/server/dev-error/index'

const report = { message: 'boom', causes: [], frames: [] } as unknown as ErrorReport

function reporterFor (overrides: Partial<Parameters<typeof createDevErrorReporter<Request>>[0]> = {}) {
  const createReport = vi.fn(() => Promise.resolve(report))
  const mapStack = vi.fn()
  const reporter = createDevErrorReporter<Request>({
    cwd: '/repo',
    channel: () => '/__nuxt_dev__/error',
    createReport,
    mapStack,
    requestInfo: request => ({ method: request.method, url: new URL(request.url), headers: request.headers }),
    ...overrides,
  })
  return { reporter, createReport, mapStack }
}

const request = () => new Request('http://localhost/failing?a=1')

describe('dev error reporter', () => {
  beforeEach(async () => {
    setErrorChannelForwarding(() => true)
    vi.spyOn(console, 'log').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
    ;(await useErrorChannel()).clearError()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('builds the report on the error as raised, then maps its stack', async () => {
    const { reporter, createReport, mapStack } = reporterFor()
    const error = new Error('boom')

    const result = await reporter(error, request())

    expect(createReport).toHaveBeenCalledWith(error, expect.any(Request))
    expect(mapStack).toHaveBeenCalledWith(error)
    expect(createReport.mock.invocationCallOrder[0]!).toBeLessThan(mapStack.mock.invocationCallOrder[0]!)
    expect(result?.report).toBe(report)
  })

  it('builds no report for an expected error, but still maps its stack', async () => {
    const { reporter, createReport, mapStack } = reporterFor()
    const error = new Error('not found')

    expect(await reporter(error, request(), { expected: true })).toBeUndefined()
    expect(createReport).not.toHaveBeenCalled()
    expect(mapStack).toHaveBeenCalledWith(error)
  })

  it('returns the report even when it is not published or printed', async () => {
    const { reporter } = reporterFor()
    const channel = await useErrorChannel()

    const result = await reporter(new Error('boom'), request(), { publish: false, print: false })

    expect(result?.report).toBe(report)
    expect(channel.current).toBeUndefined()
    expect(console.log).not.toHaveBeenCalled()
  })

  it('publishes the report on the live channel, leaving printing to whoever owns it', async () => {
    const { reporter } = reporterFor()

    await reporter(new Error('boom'), request())

    expect((await useErrorChannel()).current).toBe(report)
    expect(console.log).not.toHaveBeenCalled()
    expect(console.error).not.toHaveBeenCalled()
  })

  it('publishes a compile report to every page, whichever request ran into it', async () => {
    const messages: Array<{ report: ErrorReport, requestId?: string, request?: string }> = []
    const listener = new BroadcastChannel('nuxt:dev:error')
    listener.onmessage = event => messages.push(event.data)
    const compile = { ...report, kind: 'compile' } as ErrorReport
    const { reporter } = reporterFor({ createReport: vi.fn().mockResolvedValueOnce(report).mockResolvedValueOnce(compile) })
    const headers = { 'x-nuxt-dev-request-id': 'module-request' }

    await reporter(new Error('boom'), new Request('http://localhost/failing', { headers }))
    await reporter(new Error('boom'), new Request('http://localhost/_nuxt/app.vue', { headers }))
    await vi.waitFor(() => expect(messages).toHaveLength(2))

    expect(messages[0]).toMatchObject({ requestId: 'module-request', request: 'GET /failing' })
    expect(messages[1]).toMatchObject({ report: { kind: 'compile' }, requestId: undefined, request: undefined })
    listener.close()
  })

  it('swallows a report that cannot be built', async () => {
    const { reporter, mapStack } = reporterFor({ createReport: () => Promise.reject(new Error('no sourcemaps')) })
    const error = new Error('boom')

    expect(await reporter(error, request())).toBeUndefined()
    expect(mapStack).toHaveBeenCalledWith(error)
  })

  it('prints the report when this process owns the channel', async () => {
    setErrorChannelForwarding(() => false)
    const { reporter } = reporterFor()

    await reporter(new Error('boom'), request())

    const printed = [...vi.mocked(console.log).mock.calls, ...vi.mocked(console.error).mock.calls]
    expect(printed[0]?.[0]).toContain('[request error] [GET] http://localhost/failing?a=1')
  })
})
