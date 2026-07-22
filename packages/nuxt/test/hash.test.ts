import { describe, expect, it } from 'vitest'
import { reactive, ref } from 'vue'
import { hashFunction, hashKey } from '#app/utils/hash'

describe('hashKey', () => {
  it('is insensitive to object key order', () => {
    expect(hashKey({ a: 1, b: 2, c: 3 })).toBe(hashKey({ c: 3, a: 1, b: 2 }))
  })

  it('is stable regardless of locale collation', () => {
    const payload = { checkIn: 'foo', destination: 'bar', chapter: 'x', cache: 'y' }
    const reference = hashKey(payload)
    const original = Object.getOwnPropertyDescriptor(String.prototype, 'localeCompare')!
    try {
      // Emulate Slovak collation, where "ch" sorts after "h"; a locale-dependent
      // key sort would reorder these keys and change the hash. #34236
      Object.defineProperty(String.prototype, 'localeCompare', {
        configurable: true,
        value (this: string, other: string) {
          const rank = (s: string) => s.replace(/ch/g, '\uFFF0')
          const a = rank(this)
          const b = rank(String(other))
          return a < b ? -1 : a > b ? 1 : 0
        },
      })
      expect(hashKey(payload)).toBe(reference)
    } finally {
      Object.defineProperty(String.prototype, 'localeCompare', original)
    }
  })

  it('distinguishes different values', () => {
    expect(hashKey({ a: 1 })).not.toBe(hashKey({ a: 2 }))
    expect(hashKey([1, 2, 3])).not.toBe(hashKey([1, 3, 2]))
  })

  // `useFetch` wraps a plain-object body in `reactive()` so nested refs are unwrapped
  // to their value before hashing; hashing the ref object directly would serialize its
  // mutable internals (`version`, `dep`, ...) and drift once the ref has been written to.
  it('hashes a reactive object by value, stable across ref mutation', () => {
    const id = ref(1)
    const before = hashKey(reactive({ id }))
    id.value = 2
    id.value = 1
    expect(hashKey(reactive({ id }))).toBe(before)
    expect(hashKey(reactive({ id }))).toBe(hashKey({ id: 1 }))
  })

  it('handles the types passed as fetch keys', () => {
    expect(typeof hashKey(['$f', '/api', { method: 'GET', query: { page: 1 } }])).toBe('string')
    expect(hashKey(new Map([['a', 1], ['b', 2]]))).toBe(hashKey(new Map([['b', 2], ['a', 1]])))
  })
})

describe('hashFunction', () => {
  it('distinguishes functions by source', () => {
    expect(hashFunction(() => 1)).not.toBe(hashFunction(() => 2))
  })

  it('is stable for the same function', () => {
    const fn = (a: number, b: number) => a + b
    expect(hashFunction(fn)).toBe(hashFunction(fn))
  })

  it('hashes native functions by name and arity, not their (engine-specific) source', () => {
    // Native bodies stringify differently across engines (V8's `{ [native code] }`
    // vs JavaScriptCore's newlines), so the hash must key on name/arity instead.
    expect(hashFunction(Array.prototype.slice)).toBe(hashFunction(Array.prototype.slice))
    expect(hashFunction(Array.prototype.slice)).not.toBe(hashFunction(Array.prototype.map))
  })
})
