import { describe, expect, it, vi } from 'vitest'
import type { ServerRequest } from 'nitro/types'

const { fetchHandler } = vi.hoisted(() => ({
  fetchHandler: vi.fn((_request: Request, _caller?: { trusted?: boolean }) => Promise.resolve(new Response('stream'))),
}))
vi.mock('../src/runtime/utils/error-channel.ts', () => ({ useErrorChannel: () => Promise.resolve({ fetchHandler }) }))

const handler = await import('../src/runtime/handlers/error-channel.ts').then(m => m.default)

const request = (ip: string | undefined) => Object.assign(new Request('http://localhost/__nuxt_dev__/error/events'), { ip }) as ServerRequest

async function serve (ip: string | undefined) {
  fetchHandler.mockClear()
  const response = await handler.fetch(request(ip))
  return { status: response.status, trusted: fetchHandler.mock.lastCall?.[1]?.trusted }
}

describe('dev error channel handler', () => {
  it('trusts a peer on this machine', async () => {
    expect(await serve('127.0.0.1')).toEqual({ status: 200, trusted: true })
  })

  it('serves a peer elsewhere, untrusted', async () => {
    expect(await serve('192.168.1.24')).toEqual({ status: 200, trusted: false })
  })

  it('does not trust a peer it cannot identify', async () => {
    expect(await serve(undefined)).toEqual({ status: 200, trusted: false })
  })
})
