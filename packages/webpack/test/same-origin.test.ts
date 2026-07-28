import { describe, expect, it } from 'vitest'
import { isSameOriginRequest } from '../src/utils/same-origin'

function req (headers: Record<string, string | string[] | undefined>) {
  return { headers }
}

describe('isSameOriginRequest', () => {
  describe('with Sec-Fetch-Site present', () => {
    it('allows same-origin', () => {
      expect(isSameOriginRequest(req({ 'sec-fetch-site': 'same-origin', 'host': 'localhost:3000' }))).toBe(true)
    })

    it('allows direct browser navigation (none)', () => {
      expect(isSameOriginRequest(req({ 'sec-fetch-site': 'none', 'host': 'localhost:3000' }))).toBe(true)
    })

    it('rejects cross-site', () => {
      expect(isSameOriginRequest(req({ 'sec-fetch-site': 'cross-site', 'host': 'localhost:3000' }))).toBe(false)
    })

    it('rejects same-site (subdomain)', () => {
      expect(isSameOriginRequest(req({ 'sec-fetch-site': 'same-site', 'host': 'localhost:3000' }))).toBe(false)
    })

    it('handles array-form header values', () => {
      expect(isSameOriginRequest(req({ 'sec-fetch-site': ['cross-site', 'same-origin'], 'host': 'localhost:3000' }))).toBe(false)
    })
  })

  describe('without Sec-Fetch-Site, with Origin or Referer', () => {
    it('allows when Origin host matches Host', () => {
      expect(isSameOriginRequest(req({ origin: 'http://192.168.0.31:3000', host: '192.168.0.31:3000' }))).toBe(true)
    })

    it('rejects when Origin host differs from Host', () => {
      expect(isSameOriginRequest(req({ origin: 'http://evil.lan', host: '192.168.0.31:3000' }))).toBe(false)
    })

    it('allows when Referer host matches Host', () => {
      expect(isSameOriginRequest(req({ referer: 'http://192.168.0.31:3000/some/page', host: '192.168.0.31:3000' }))).toBe(true)
    })

    it('rejects the GHSA-6m52-m754-pw2g shape (LAN attacker, Referer present)', () => {
      expect(isSameOriginRequest(req({ referer: 'http://evil.lan/', host: '192.168.0.31:3000' }))).toBe(false)
    })

    it('rejects unparseable initiators', () => {
      expect(isSameOriginRequest(req({ origin: 'not a url', host: '192.168.0.31:3000' }))).toBe(false)
    })
  })

  describe('GHSA-x6qj-4h56-5rj5: no Sec-Fetch-Site, no Origin, no Referer', () => {
    it('allows when the dev server is loopback-bound (localhost)', () => {
      expect(isSameOriginRequest(req({ host: 'localhost:3000' }))).toBe(true)
    })

    it('allows when the dev server is loopback-bound (127.0.0.1)', () => {
      expect(isSameOriginRequest(req({ host: '127.0.0.1:3000' }))).toBe(true)
    })

    it('allows when the dev server is loopback-bound (IPv6 ::1)', () => {
      expect(isSameOriginRequest(req({ host: '[::1]:3000' }))).toBe(true)
    })

    it('rejects when the dev server is bound to a non-loopback LAN address', () => {
      expect(isSameOriginRequest(req({ host: '192.168.0.31:3000' }))).toBe(false)
    })

    it('rejects when the dev server is bound to 0.0.0.0 served via a LAN Host header', () => {
      expect(isSameOriginRequest(req({ host: '10.0.0.5:3000' }))).toBe(false)
    })

    it('rejects when the Host header is absent', () => {
      expect(isSameOriginRequest(req({}))).toBe(false)
    })
  })
})
