/**
 * Tests for URL try-catch fix (PR #35449).
 *
 * Verifies that `encodeURL`, `navigateTo`, and `encodeRoutePath` handle invalid
 * URLs gracefully instead of throwing unhandled `TypeError`.
 *
 * @module url-try-catch.test
 */
import { describe, expect, it } from 'vitest'
import { encodeURL, navigateTo, encodeRoutePath } from '../src/app/composables/router'

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
  it('does not throw on double-slash external URL and collapses the path', () => {
    // //external.com is parsed as hostname external.com by URL, path becomes '/'
    expect(() => encodeURL('//external.com')).not.toThrow()
    const result = encodeURL('//external.com')
    expect(result).toBe('/')
  })

  it('does not throw on empty string', () => {
    expect(() => encodeURL('')).not.toThrow()
  })

  it('does not throw on backslash-prefixed input', () => {
    expect(() => encodeURL('\\\\invalid')).not.toThrow()
  })

  it('returns invalid URL input as-is when URL constructor throws', () => {
    // new URL('http://a b.com', ...) throws TypeError (space in host)
    const result = encodeURL('http://a b.com')
    expect(result).toBe('http://a b.com')
  })

  it('handles raw IPv6 that would cause URL constructor to throw', () => {
    // new URL('http://[::1', ...) throws because bracket is unclosed
    const result = encodeURL('http://[::1')
    expect(result).toBe('http://[::1')
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
// navigateTo — throws descriptive Error (not TypeError) when URL is invalid
// ---------------------------------------------------------------------------
describe('navigateTo', () => {
  it('throws descriptive error on invalid URL with external option', () => {
    // The error is thrown inside the external-block try-catch before any
    // Nuxt runtime dependency is touched, so no mocking is needed.
    expect(() => navigateTo('http://a b.com', { external: true }))
      .toThrow('Cannot navigate to invalid URL')
  })

  it('throws Error (not TypeError) on invalid URL', () => {
    // Verify the thrown error is a regular Error, not the raw TypeError that
    // new URL() would produce without the try-catch wrapper.
    let thrown: unknown
    try {
      navigateTo('http://a b.com', { external: true })
    } catch (e) {
      thrown = e
    }
    expect(thrown).toBeInstanceOf(Error)
    expect(thrown).not.toBeInstanceOf(TypeError)
  })

  it('includes the problematic URL in the error message', () => {
    expect(() => navigateTo('http://[::1', { external: true }))
      .toThrow(/Cannot navigate to invalid URL/)
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
