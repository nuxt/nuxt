import { describe, expect, it, vi } from 'vitest'
import type { ServerRequest } from 'nitro/types'

const { fetchHandler } = vi.hoisted(() => ({ fetchHandler: vi.fn(() => Promise.resolve(new Response('stream'))) }))
vi.mock('../src/runtime/utils/error-channel.ts', () => ({ useErrorChannel: () => Promise.resolve({ fetchHandler }) }))

const handler = await import('../src/runtime/handlers/error-channel.ts').then(m => m.default)

const request = (ip: string | undefined) => Object.assign(new Request('http://localhost/__nuxt_dev__/error/events'), { ip }) as ServerRequest

describe('dev error channel handler', () => {
  it.each(['127.0.0.1', '127.1.2.3', '::1', '[::1]', '::ffff:127.0.0.1'])('serves a peer on this machine at %s', async (ip) => {
    expect((await handler.fetch(request(ip))).status).toBe(200)
  })

  it.each(['192.168.1.24', '10.0.0.7', '::ffff:192.168.1.24', '2001:db8::1', undefined])('refuses a peer elsewhere at %s', async (ip) => {
    fetchHandler.mockClear()
    expect((await handler.fetch(request(ip))).status).toBe(403)
    expect(fetchHandler).not.toHaveBeenCalled()
  })
})
