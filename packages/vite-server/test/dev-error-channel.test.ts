import { describe, expect, it, vi } from 'vitest'

const { fetchHandler } = vi.hoisted(() => ({ fetchHandler: vi.fn(() => Promise.resolve(new Response('stream'))) }))
vi.mock('nuxt/internal/dev-error', () => ({
  ERROR_CHANNEL_ENV: 'NUXT_DEV_ERROR_CHANNEL',
  setErrorChannelForwarding: () => {},
  useErrorChannel: () => Promise.resolve({ fetchHandler }),
  createErrorReport: () => Promise.resolve({}),
  publishErrorReport: () => Promise.resolve(),
  renderErrorAnsi: () => Promise.resolve(''),
  renderErrorPage: () => Promise.resolve(''),
  requestIdOf: () => undefined,
  serializeErrorCause: () => undefined,
  withErrorOverlay: () => Promise.resolve(''),
}))

const { fetchErrorChannel } = await import('../src/runtime/dev-error.ts')

const request = (ip: string | undefined) => Object.assign(new Request('http://localhost/__nuxt_dev__/error/events'), { ip })

describe('dev error channel', () => {
  it.each(['127.0.0.1', '::1', '::ffff:127.0.0.1'])('serves a peer on this machine at %s', async (ip) => {
    expect((await fetchErrorChannel(request(ip))).status).toBe(200)
  })

  it.each(['192.168.1.24', '2001:db8::1', undefined])('refuses a peer elsewhere at %s', async (ip) => {
    fetchHandler.mockClear()
    expect((await fetchErrorChannel(request(ip))).status).toBe(403)
    expect(fetchHandler).not.toHaveBeenCalled()
  })
})
