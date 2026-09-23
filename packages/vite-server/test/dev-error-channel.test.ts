import { describe, expect, it, vi } from 'vitest'

const { fetchHandler } = vi.hoisted(() => ({
  fetchHandler: vi.fn((_request: Request, _caller?: { trusted?: boolean }) => Promise.resolve(new Response('stream'))),
}))
vi.mock('nuxt/internal/dev-error', () => ({
  ERROR_CHANNEL_ENV: 'NUXT_DEV_ERROR_CHANNEL',
  setErrorChannelForwarding: () => {},
  useErrorChannel: () => Promise.resolve({ fetchHandler }),
  createErrorReport: () => Promise.resolve({}),
  createDevErrorReporter: () => () => Promise.resolve(undefined),
  serializeErrorCause: () => undefined,
}))

const { fetchErrorChannel } = await import('../src/runtime/dev-error.ts')

const request = (ip: string | undefined) => Object.assign(new Request('http://localhost/__nuxt_dev__/error/events'), { ip })

async function serve (ip: string | undefined) {
  fetchHandler.mockClear()
  const response = await fetchErrorChannel(request(ip))
  return { status: response.status, trusted: fetchHandler.mock.lastCall?.[1]?.trusted }
}

describe('dev error channel', () => {
  it('trusts a peer on this machine', async () => {
    expect(await serve('::ffff:127.0.0.1')).toEqual({ status: 200, trusted: true })
  })

  it('serves a peer elsewhere, untrusted', async () => {
    expect(await serve('192.168.1.24')).toEqual({ status: 200, trusted: false })
  })

  it('does not trust a peer it cannot identify', async () => {
    expect(await serve(undefined)).toEqual({ status: 200, trusted: false })
  })
})
