import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import process from 'node:process'
import type { ServerRequest } from 'nitro/types'
import { DEV_PEER_HEADER, DEV_PEER_TOKEN_ENV } from 'nuxt/internal/dev/peer'

const { fetchHandler } = vi.hoisted(() => ({
  fetchHandler: vi.fn((_request: Request, _caller?: { trusted?: boolean }) => Promise.resolve(new Response('stream'))),
}))
vi.mock('../src/runtime/utils/error-channel.ts', () => ({ useErrorChannel: () => Promise.resolve({ fetchHandler }) }))

const handler = await import('../src/runtime/handlers/error-channel.ts').then(m => m.default)

const token = 'a-token-the-dev-server-shares-with-the-app'

function request (ip: string | undefined, headers: Record<string, string> = {}) {
  return Object.assign(new Request('http://localhost/__nuxt_dev__/error/events', { headers }), { ip }) as ServerRequest
}

async function serve (ip: string | undefined, headers?: Record<string, string>) {
  fetchHandler.mockClear()
  const response = await handler.fetch(request(ip, headers))
  return { status: response.status, trusted: fetchHandler.mock.lastCall?.[1]?.trusted }
}

describe('dev error channel handler', () => {
  beforeEach(() => {
    process.env[DEV_PEER_TOKEN_ENV] = token
  })
  afterEach(() => {
    delete process.env[DEV_PEER_TOKEN_ENV]
  })

  it('trusts a request the dev server in front vouched for', async () => {
    expect(await serve(undefined, { [DEV_PEER_HEADER]: token })).toEqual({ status: 200, trusted: true })
  })

  it('does not trust a loopback socket the dev server in front did not vouch for', async () => {
    expect(await serve('127.0.0.1')).toEqual({ status: 200, trusted: false })
    expect(await serve('127.0.0.1', { 'x-forwarded-for': '127.0.0.1' })).toEqual({ status: 200, trusted: false })
  })

  it('does not trust a forged voucher', async () => {
    expect(await serve('127.0.0.1', { [DEV_PEER_HEADER]: `${token.slice(0, -1)}x` })).toEqual({ status: 200, trusted: false })
    expect(await serve('127.0.0.1', { [DEV_PEER_HEADER]: '' })).toEqual({ status: 200, trusted: false })
  })

  it('does not trust anything without a token to check against', async () => {
    delete process.env[DEV_PEER_TOKEN_ENV]
    expect(await serve('127.0.0.1', { [DEV_PEER_HEADER]: 'undefined' })).toEqual({ status: 200, trusted: false })
  })
})
