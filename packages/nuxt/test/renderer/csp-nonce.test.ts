import { describe, expect, it } from 'vitest'

import { addNonceToTags, extractCspNonce } from '../../src/runtime/server/renderer/csp-nonce.ts'

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

describe('addNonceToTags', () => {
  it('adds nonce to a plain script tag', () => {
    expect(addNonceToTags('<script src="/a.js"></script>', 'abc'))
      .toBe('<script src="/a.js" nonce="abc"></script>')
  })

  it('does not add a second nonce when one already exists', () => {
    expect(addNonceToTags('<script nonce="existing" src="/a.js"></script>', 'abc'))
      .toBe('<script nonce="existing" src="/a.js"></script>')
  })

  it('handles multiple tags in the same html', () => {
    expect(addNonceToTags('<script src="/a.js"></script><style>body{color:red}</style>', 'abc'))
      .toBe('<script src="/a.js" nonce="abc"></script><style nonce="abc">body{color:red}</style>')
  })

  it('ignores tag-like text inside a script body', () => {
    expect(addNonceToTags('<script>const tag = "<script>"</script>', 'abc'))
      .toBe('<script nonce="abc">const tag = "<script>"</script>')
  })

  it('ignores tag-like text inside a style body', () => {
    expect(addNonceToTags('<style>/* <style> */body{color:red}</style>', 'abc'))
      .toBe('<style nonce="abc">/* <style> */body{color:red}</style>')
  })
})
