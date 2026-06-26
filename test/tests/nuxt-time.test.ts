// Standalone test for nuxt-time toCamelCase fix
// Run: npx vitest run test/tests/nuxt-time.test.ts

import { describe, expect, it } from 'vitest'

// Extracted toCamelCase function from nuxt-time.vue
// BEFORE fix: name[0]!.toUpperCase() + name.slice(1) — crashes on empty string
// AFTER  fix: (name[0]?.toUpperCase() ?? '') + name.slice(1) — safe
function toCamelCaseFixed (name: string, index: number): string {
  if (index > 0) {
    return (name[0]?.toUpperCase() ?? '') + name.slice(1)
  }
  return name
}

// Old version for comparison
function toCamelCaseOld (name: string, index: number): string {
  if (index > 0) {
    return name[0]!.toUpperCase() + name.slice(1)
  }
  return name
}

describe('nuxt-time toCamelCase — edge case fix', () => {
  describe('happy path', () => {
    it('capitalizes first letter when index > 0', () => {
      expect(toCamelCaseFixed('hello', 1)).toBe('Hello')
    })

    it('returns unchanged when index === 0', () => {
      expect(toCamelCaseFixed('hello', 0)).toBe('hello')
    })

    it('handles single character', () => {
      expect(toCamelCaseFixed('a', 1)).toBe('A')
    })
  })

  describe('negative — empty string edge case (THE BUG)', () => {
    it('OLD version CRASHES on empty string (proving the bug)', () => {
      expect(() => toCamelCaseOld('', 1)).toThrow()
    })

    it('NEW version returns empty string safely', () => {
      expect(() => toCamelCaseFixed('', 1)).not.toThrow()
      expect(toCamelCaseFixed('', 1)).toBe('')
    })

    it('NEW version returns empty string when empty + index 0', () => {
      expect(toCamelCaseFixed('', 0)).toBe('')
    })
  })

  describe('edge cases', () => {
    it('handles numeric string', () => {
      expect(toCamelCaseFixed('123', 1)).toBe('123')
    })

    // Simulasi: split('data--foo') menghasilkan ['data', '', 'foo']
    it('simulates data--foo attribute parsing', () => {
      const segments = 'data--foo'.split('-') // ['data', '', 'foo']
      const result = segments.map(toCamelCaseFixed).join('')
      // 'data' + '' + 'Foo' = 'dataFoo'
      expect(result).toBe('dataFoo')
    })

    it('OLD version crashes with data--foo pattern', () => {
      const segments = 'data--foo'.split('-')
      expect(() => segments.map(toCamelCaseOld).join('')).toThrow()
    })

    it('handles multiple consecutive dashes', () => {
      const segments = 'data---foo'.split('-') // ['data', '', '', 'foo']
      const result = segments.map(toCamelCaseFixed).join('')
      // 'data' + '' + '' + 'Foo' = 'dataFoo'
      expect(result).toBe('dataFoo')
    })
  })
})
