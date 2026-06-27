/**
 * Tests for URL try-catch fix (PR #35449).
 *
 * Verifies that `encodeURL` and `encodeRoutePath` handle invalid URLs gracefully
 * using `parseURL` from `ufo` instead of try-catch.
 *
 * @module url-try-catch.test
 */
import { describe, expect, it } from 'vitest'
import { encodeRoutePath, encodeURL } from '../src/app/composables/router'

// ---------------------------------------------------------------------------
// encodeURL — pure function; no mocks needed
// ---------------------------------------------------------------------------
describe('encodeURL', () => {
  // ── Happy path ───────────────────────────────────────────────────────────
  it('returns a normal path as-is', () => {
    expect(encodeURL('/foo/bar')).toBe('/foo/bar')
  })

  it('preserves query string', () => {
    expect(encodeURL('/foo?query=1')).toBe('/foo?query=1')
  })

  it('preserves hash fragment', () => {
    expect(encodeURL('/foo#hash')).toBe('/foo#hash')
  })

  // ── Negative / edge cases ────────────────────────────────────────────────
  it('does not throw on protocol-relative URL and falls back to raw input', () => {
    // parseURL returns empty pathname for //external.com, so encodeURL
    // falls back to the raw input when no meaningful components exist.
    expect(() => encodeURL('//external.com')).not.toThrow()
    expect(encodeURL('//external.com')).toBe('//external.com')
  })

  it('does not throw on empty string', () => {
    expect(() => encodeURL('')).not.toThrow()
  })

  it('does not throw on backslash-prefixed input', () => {
    expect(() => encodeURL('\\\\invalid')).not.toThrow()
  })

  it('returns invalid URL input as-is when parseURL yields no useful parts', () => {
    // parseURL is lenient and parses 'http://a b.com' with host='a b.com'
    // but pathname/search/hash are empty, so encodeURL falls back to raw input.
    expect(encodeURL('http://a b.com')).toBe('http://a b.com')
  })

  it('falls back to raw input for broken IPv6 URL', () => {
    // parseURL parses 'http://[::1' with host='[::1' and empty pathname,
    // so encodeURL returns the raw input since no meaningful parts exist.
    expect(encodeURL('http://[::1')).toBe('http://[::1')
  })

  it('handles isExternalHost=true with valid URL', () => {
    const result = encodeURL('http://example.com/foo', true)
    expect(result).toContain('http://example.com/foo')
  })

  it('handles isExternalHost=true with double-slash URL', () => {
    const result = encodeURL('//example.com/foo', true)
    expect(result).toContain('example.com/foo')
  })
})

// ---------------------------------------------------------------------------
// encodeRoutePath — sanity check that it stays safe
// ---------------------------------------------------------------------------
describe('encodeRoutePath', () => {
  it('encodes a decoded path', () => {
    expect(encodeRoutePath('/café')).toBe('/caf%C3%A9')
  })

  it('does not double-encode an already-encoded path', () => {
    expect(encodeRoutePath('/caf%C3%A9')).toBe('/caf%C3%A9')
  })
})
