import { describe, expect, it } from 'vitest'
import { decodePayload, encodePayload } from '../../src/app/internal/payload-codec.ts'

describe('payload codec', () => {
  it('round-trips complex payloads with unicode and script-breaking characters', () => {
    const raw = JSON.stringify([
      { data: 1, pinia: 2 },
      {},
      { featureFlags: { isNafathBypassEnabled: false }, greeting: 'مرحبا </script> 🚀' },
    ])
    const key = 'dynamic-build-key-2026'
    const encoded = encodePayload(raw, key)

    expect(encoded).not.toContain('featureFlags')
    expect(encoded).not.toContain('isNafathBypassEnabled')
    expect(encoded).not.toContain('</script>')
    expect(encoded).toMatch(/^[\w-]+$/)
    expect(decodePayload(encoded, key)).toBe(raw)
  })

  it('produces different output for different build keys', () => {
    const raw = '[{"pinia":1},{"secretFlag":true}]'
    expect(encodePayload(raw, 'key-1')).not.toBe(encodePayload(raw, 'key-2'))
  })

  it('handles large payloads without stack overflow', () => {
    const raw = 'x'.repeat(200_000)
    const key = 'large-payload-key'
    const encoded = encodePayload(raw, key)
    expect(decodePayload(encoded, key)).toBe(raw)
  })
})
