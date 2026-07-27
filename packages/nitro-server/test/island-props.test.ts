import { describe, expect, it } from 'vitest'
import { MAX_ISLAND_BODY_BYTES, MAX_ISLAND_PROP_DEPTH, exceedsMaxBytes, exceedsMaxDepth } from '../src/runtime/utils/island-props.ts'

describe('exceedsMaxBytes', () => {
  it('accepts a small body', () => {
    expect(exceedsMaxBytes(JSON.stringify({ props: JSON.stringify({ count: 3 }) }))).toBe(false)
  })

  it('rejects a body over the byte cap', () => {
    const big = JSON.stringify(Object.fromEntries(Array.from({ length: 150_000 }, (_, i) => [`k${i}`, i])))
    expect(big.length).toBeGreaterThan(MAX_ISLAND_BODY_BYTES)
    expect(exceedsMaxBytes(big)).toBe(true)
  })

  it('measures UTF-8 bytes rather than string length', () => {
    const raw = '"' + '\u{1F4A5}'.repeat(MAX_ISLAND_BODY_BYTES / 4) + '"'
    expect(raw.length).toBeLessThan(MAX_ISLAND_BODY_BYTES)
    expect(exceedsMaxBytes(raw)).toBe(true)
  })
})

describe('exceedsMaxDepth', () => {
  it('accepts a shallow object', () => {
    expect(exceedsMaxDepth('{"a":{"b":{"c":1}}}')).toBe(false)
  })

  it('rejects nesting beyond the cap', () => {
    const deep = '['.repeat(MAX_ISLAND_PROP_DEPTH + 5) + ']'.repeat(MAX_ISLAND_PROP_DEPTH + 5)
    expect(exceedsMaxDepth(deep)).toBe(true)
  })

  it('does not count brackets inside string values', () => {
    const raw = JSON.stringify({ note: '['.repeat(MAX_ISLAND_PROP_DEPTH + 100) })
    expect(exceedsMaxDepth(raw)).toBe(false)
  })

  it('ignores escaped quotes when tracking string state', () => {
    const raw = JSON.stringify({ q: '"' + '['.repeat(MAX_ISLAND_PROP_DEPTH + 100) })
    expect(exceedsMaxDepth(raw)).toBe(false)
  })
})
