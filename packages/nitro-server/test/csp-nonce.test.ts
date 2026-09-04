import { describe, expect, it } from 'vitest'

import { extractCspNonce } from '../src/runtime/utils/renderer/csp-nonce.ts'

describe('extractCspNonce', () => {
  it('extracts a nonce from a head script', () => {
    expect(extractCspNonce('<script nonce="abc123" src="/_nuxt/entry.js"></script>')).toBe('abc123')
    expect(extractCspNonce('<script type="module" src="/_nuxt/entry.js" nonce="abc123"></script>')).toBe('abc123')
    expect(extractCspNonce('<link rel="preload" href="/a.js"><script defer nonce="a+b/c-d_e="></script>')).toBe('a+b/c-d_e=')
  })

  it('ignores attributes that merely end in `nonce`', () => {
    expect(extractCspNonce('<script data-nonce="fake" src="/_nuxt/entry.js"></script>')).toBeUndefined()
    expect(extractCspNonce('<script data-nonce="fake" nonce="real"></script>')).toBe('real')
  })

  it('ignores tags that merely start with `script`', () => {
    expect(extractCspNonce('<scriptish nonce="fake"></scriptish>')).toBeUndefined()
  })

  it('returns undefined when no nonce is present', () => {
    expect(extractCspNonce('')).toBeUndefined()
    expect(extractCspNonce('<script src="/_nuxt/entry.js"></script>')).toBeUndefined()
    expect(extractCspNonce('<script nonce=""></script>')).toBeUndefined()
  })

  it('ignores values that are not valid nonces', () => {
    expect(extractCspNonce('<script nonce="a b"></script>')).toBeUndefined()
    expect(extractCspNonce('<script nonce="a><img src=x onerror=alert(1)"></script>')).toBeUndefined()
  })
})
