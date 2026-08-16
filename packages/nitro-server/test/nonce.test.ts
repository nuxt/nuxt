import { describe, expect, it } from 'vitest'

import { getNonceFromHeadTags } from '../src/runtime/utils/renderer/nonce.ts'

describe('getNonceFromHeadTags', () => {
  it('extracts the real nonce attribute from rendered head tags', () => {
    expect(getNonceFromHeadTags('<script nonce="real-nonce">x=1</script>')).toBe('real-nonce')
  })

  it('does not mistake a data-nonce attribute for the CSP nonce', () => {
    // A script may legitimately carry an unrelated `data-nonce` (or any other
    // `*-nonce`) attribute. The renderer must only thread the exact `nonce`
    // attribute stamped by a security module, otherwise the inline scripts it
    // emits (bootstrap, IIFE, head pushes, island relocation) would carry the
    // wrong value and be blocked by a strict `script-src 'nonce-…'` policy.
    const headTags = '<script data-nonce="fake" data-hid="x">a=1</script><script nonce="real-nonce" data-hid="csp">b=1</script>'
    expect(getNonceFromHeadTags(headTags)).toBe('real-nonce')
  })

  it('returns undefined when no nonce attribute is present', () => {
    expect(getNonceFromHeadTags('<script>a=1</script>')).toBeUndefined()
  })
})
