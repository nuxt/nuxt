import { describe, expect, it } from 'vitest'
import type { H3Event } from 'nitro/h3'
import { DEV_PEER_HEADER } from 'nuxt/internal/dev/peer'
import { isLocalDevRequest, isLoopbackPeer, vouchForLoopbackPeer } from '../src/dev-request.ts'

function event (headers: Record<string, string>, ip?: string, path = '/'): H3Event {
  return {
    req: { ip, headers: new Headers(headers) },
    url: new URL(path, 'http://localhost'),
  } as unknown as H3Event
}

describe('vouchForLoopbackPeer', () => {
  const vouched = (e: H3Event) => {
    vouchForLoopbackPeer(e, '/__nuxt_dev__/error/', 'token')
    return e.req.headers.get(DEV_PEER_HEADER)
  }

  it('vouches for a loopback peer of the error channel', () => {
    expect(vouched(event({}, '127.0.0.1', '/__nuxt_dev__/error/events'))).toBe('token')
    expect(vouched(event({}, '::1', '/base/__nuxt_dev__/error/open'))).toBe('token')
  })

  it('drops a voucher sent by a peer elsewhere', () => {
    expect(vouched(event({ [DEV_PEER_HEADER]: 'token', 'x-forwarded-for': '127.0.0.1' }, '192.168.0.31', '/__nuxt_dev__/error/events'))).toBeNull()
    expect(vouched(event({ [DEV_PEER_HEADER]: 'token' }, undefined, '/__nuxt_dev__/error/events'))).toBeNull()
  })

  it('only vouches for requests to the error channel', () => {
    expect(vouched(event({ [DEV_PEER_HEADER]: 'token' }, '127.0.0.1', '/api/echo'))).toBeNull()
  })
})

describe('isLoopbackPeer', () => {
  it('trusts the TCP peer address, not the Host header', () => {
    expect(isLoopbackPeer(event({ host: 'localhost:3000' }, '192.168.0.31'))).toBe(false)
    expect(isLoopbackPeer(event({ host: '192.168.0.31:3000' }, '127.0.0.1'))).toBe(true)
  })

  it('ignores a spoofable x-forwarded-for header', () => {
    expect(isLoopbackPeer(event({ 'host': 'evil.lan', 'x-forwarded-for': '127.0.0.1' }, '192.168.0.31'))).toBe(false)
  })

  it('rejects when no peer address is available', () => {
    expect(isLoopbackPeer(event({ host: 'localhost:3000' }))).toBe(false)
  })
})

// The devtools workspace endpoint discloses `workspace.root` / `uuid` only when both
// gates pass; this mirrors the handler's condition.
describe('devtools workspace disclosure gate', () => {
  const allowedHosts = new Set(['localhost', '127.0.0.1', '[::1]', '::1'])
  const discloses = (e: H3Event) => isLoopbackPeer(e) && isLocalDevRequest(e, allowedHosts)

  it('does not disclose to a direct LAN client with no browser-origin headers', () => {
    expect(discloses(event({ host: 'localhost:3000' }, '192.168.0.31'))).toBe(false)
  })

  it('does not disclose to a LAN client even when Host is spoofed to loopback', () => {
    expect(discloses(event({ host: '127.0.0.1:3000' }, '192.168.0.31'))).toBe(false)
  })

  it('discloses to a genuine local browser navigation', () => {
    expect(discloses(event({ 'host': 'localhost:3000', 'sec-fetch-site': 'none' }, '127.0.0.1'))).toBe(true)
  })

  it('discloses to a same-origin fetch from a loopback peer', () => {
    expect(discloses(event({ 'host': 'localhost:3000', 'sec-fetch-site': 'same-origin' }, '::1'))).toBe(true)
  })

  it('does not disclose to a cross-site browser request from a loopback peer', () => {
    expect(discloses(event({ 'host': 'localhost:3000', 'sec-fetch-site': 'cross-site' }, '127.0.0.1'))).toBe(false)
  })
})
