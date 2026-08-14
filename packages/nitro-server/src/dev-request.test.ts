import { describe, expect, it } from 'vitest'
import type { H3Event } from 'nitro/h3'
import { isLocalDevRequest, isLoopbackAddress, isLoopbackPeer } from './dev-request.ts'

function event (headers: Record<string, string>, ip?: string): H3Event {
  return {
    req: { ip, headers: new Headers(headers) },
  } as unknown as H3Event
}

describe('isLoopbackAddress', () => {
  it.each([
    ['127.0.0.1'],
    ['127.1.2.3'],
    ['::1'],
    ['[::1]'],
    ['::ffff:127.0.0.1'],
    ['::FFFF:127.0.0.1'],
    ['::1%lo0'],
  ])('treats %s as loopback', (address) => {
    expect(isLoopbackAddress(address)).toBe(true)
  })

  it.each([
    ['192.168.0.31'],
    ['10.0.0.5'],
    ['0.0.0.0'],
    ['::ffff:192.168.0.31'],
    ['fe80::1'],
    [''],
    [undefined],
    [null],
  ])('rejects %s', (address) => {
    expect(isLoopbackAddress(address)).toBe(false)
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
