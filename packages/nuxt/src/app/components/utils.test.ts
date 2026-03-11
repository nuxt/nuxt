import { describe, it, expect } from 'vitest'
import {
  normalizeComponentName,
  resolveComponentPath,
  isLazyComponent,
  getComponentPriority,
} from './utils'

describe('component utilities', () => {
  describe('normalizeComponentName', () => {
    it('should normalize PascalCase names', () => {
      expect(normalizeComponentName('MyComponent')).toBe('MyComponent')
      expect(normalizeComponentName('MyComponent')).toBe('MyComponent')
    })

    it('should normalize kebab-case names', () => {
      expect(normalizeComponentName('my-component')).toBe('MyComponent')
      expect(normalizeComponentName('my-long-component-name')).toBe('MyLongComponentName')
    })

    it('should handle edge cases', () => {
      expect(normalizeComponentName('')).toBe('')
      expect(normalizeComponentName('a')).toBe('A')
      expect(normalizeComponentName('alreadyPascal')).toBe('AlreadyPascal')
    })
  })

  describe('resolveComponentPath', () => {
    it('should resolve component paths', () => {
      expect(resolveComponentPath('~/components/Button.vue')).toBe('~/components/Button.vue')
      expect(resolveComponentPath('@/components/Card')).toBe('@/components/Card.vue')
    })

    it('should add .vue extension if missing', () => {
      expect(resolveComponentPath('~/components/Button')).toBe('~/components/Button.vue')
    })

    it('should handle nested paths', () => {
      expect(resolveComponentPath('~/components/ui/Button')).toBe('~/components/ui/Button.vue')
    })
  })

  describe('isLazyComponent', () => {
    it('should identify lazy components', () => {
      expect(isLazyComponent('LazyButton')).toBe(true)
      expect(isLazyComponent('LazyMyComponent')).toBe(true)
    })

    it('should reject non-lazy components', () => {
      expect(isLazyComponent('Button')).toBe(false)
      expect(isLazyComponent('MyComponent')).toBe(false)
      expect(isLazyComponent('')).toBe(false)
    })

    it('should be case-insensitive', () => {
      expect(isLazyComponent('lazyButton')).toBe(true)
      expect(isLazyComponent('LAZYCARD')).toBe(true)
    })
  })

  describe('getComponentPriority', () => {
    it('should return priority for components', () => {
      expect(getComponentPriority('Button', ['Button', 'Card'])).toBe(0)
      expect(getComponentPriority('Card', ['Button', 'Card'])).toBe(1)
    })

    it('should return -1 for unknown components', () => {
      expect(getComponentPriority('Unknown', ['Button', 'Card'])).toBe(-1)
    })

    it('should handle empty arrays', () => {
      expect(getComponentPriority('Button', [])).toBe(-1)
    })
  })
})
