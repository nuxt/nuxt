import fc from 'fast-check'
import { describe, expect, it } from 'vitest'

import { uniqueBy } from '../src/core/utils/index.ts'

describe('uniqueBy', () => {
  const item = fc.record({ id: fc.integer({ min: 0, max: 5 }), value: fc.string() })

  it('should keep the first item for each key, in order', () => {
    fc.assert(fc.property(fc.array(item, { maxLength: 10 }), (items) => {
      const result = uniqueBy(items, 'id')

      expect(result.map(entry => entry.id)).toEqual([...new Set(items.map(entry => entry.id))])
      for (const entry of result) {
        expect(entry).toBe(items.find(candidate => candidate.id === entry.id))
      }
      expect(items.every(entry => result.some(candidate => candidate.id === entry.id))).toBe(true)
    }), { numRuns: 1000 })
  })

  it('should be idempotent', () => {
    fc.assert(fc.property(fc.array(item, { maxLength: 10 }), (items) => {
      const once = uniqueBy(items, 'id')
      expect(uniqueBy(once, 'id')).toEqual(once)
    }), { numRuns: 1000 })
  })
})
