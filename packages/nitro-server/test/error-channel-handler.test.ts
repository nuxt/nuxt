import { describe, expect, it, vi } from 'vitest'
import type { H3Event } from 'h3'

const { fetchHandler } = vi.hoisted(() => ({
  fetchHandler: vi.fn((_request: Request, _caller?: { trusted?: boolean }) => Promise.resolve(new Response('stream'))),
}))
vi.mock('../src/runtime/utils/error-channel.ts', () => ({ useErrorChannel: () => Promise.resolve({ fetchHandler }) }))
vi.mock('h3', async importOriginal => ({
  ...await importOriginal<typeof import('h3')>(),
  toWebRequest: () => new Request('http://localhost/__nuxt_dev__/error/events'),
}))

const handler = await import('../src/runtime/handlers/error-channel.ts').then(m => m.default)

function event (ip: string | undefined): H3Event {
  return { context: {}, node: { req: { headers: {}, socket: { remoteAddress: ip } } } } as unknown as H3Event
}

async function serve (ip: string | undefined) {
  fetchHandler.mockClear()
  const response = await handler(event(ip)) as Response
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
