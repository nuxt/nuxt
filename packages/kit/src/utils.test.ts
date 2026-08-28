import fc from 'fast-check'
import { describe, expect, it } from 'vitest'

import { filterInPlace, toArray } from './utils.ts'

describe('toArray', () => {
  it('should wrap a single value and pass an array through unchanged', () => {
    fc.assert(fc.property(fc.oneof(fc.integer(), fc.string(), fc.constant(null), fc.array(fc.integer())), (value) => {
      const result = toArray(value)
      expect(Array.isArray(result)).toBe(true)
      expect(result).toEqual(Array.isArray(value) ? value : [value])
    }), { numRuns: 1000 })
  })
})

describe('filterInPlace', () => {
  it('should match Array#filter and mutate the array in place', () => {
    fc.assert(fc.property(fc.array(fc.integer({ min: 0, max: 20 }), { maxLength: 20 }), fc.integer({ min: 0, max: 20 }), (values, threshold) => {
      const predicate = (value: number) => value < threshold
      const array = [...values]
      const result = filterInPlace(array, predicate)
      expect(result).toBe(array)
      expect(array).toEqual(values.filter(predicate))
    }), { numRuns: 1000 })
  })

  it('should pass each remaining item its own index', () => {
    fc.assert(fc.property(fc.array(fc.integer({ min: 0, max: 20 }), { maxLength: 20 }), (values) => {
      const seen: Array<[number, number]> = []
      const array = [...values]
      filterInPlace(array, (item, index) => {
        seen.push([item, index])
        return true
      })
      expect(seen).toEqual(values.map((item, index) => [item, index] as [number, number]).reverse())
    }), { numRuns: 1000 })
  })
})
