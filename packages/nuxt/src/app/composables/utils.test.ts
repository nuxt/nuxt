import { describe, it, expect, vi } from 'vitest'
import {
  resolveComposableName,
  isValidComposable,
  extractComposableMeta,
  validateComposableOptions,
} from './utils'

describe('composables utils', () => {
  describe('resolveComposableName', () => {
    it('should resolve composable names correctly', () => {
      expect(resolveComposableName('useCounter')).toBe('useCounter')
      expect(resolveComposableName('useUserStore')).toBe('useUserStore')
      expect(resolveComposableName('useAuth')).toBe('useAuth')
    })

    it('should handle invalid names', () => {
      expect(() => resolveComposableName('')).toThrow()
      expect(() => resolveComposableName('counter')).toThrow()
      expect(() => resolveComposableName('123useCounter')).toThrow()
    })

    it('should normalize names', () => {
      expect(resolveComposableName('UseCounter')).toBe('useCounter')
      expect(resolveComposableName('USE_STATE')).toBe('useState')
      expect(resolveComposableName('UseAuth')).toBe('useAuth')
    })
  })

  describe('isValidComposable', () => {
    it('should validate composable functions', () => {
      const validComposable = () => ({ count: 0 })
      expect(isValidComposable(validComposable)).toBe(true)
    })

    it('should reject invalid composables', () => {
      expect(isValidComposable(null)).toBe(false)
      expect(isValidComposable(undefined)).toBe(false)
      expect(isValidComposable('string')).toBe(false)
      expect(isValidComposable(123)).toBe(false)
      expect(isValidComposable({})).toBe(false)
    })

    it('should check composable signature', () => {
      const asyncComposable = async () => ({ data: null })
      expect(isValidComposable(asyncComposable)).toBe(true)
    })
  })

  describe('extractComposableMeta', () => {
    it('should extract metadata from composable', () => {
      const composable = () => ({ count: 0 })
      composable.meta = { name: 'useCounter', version: '1.0.0' }
      
      const meta = extractComposableMeta(composable)
      expect(meta).toEqual({ name: 'useCounter', version: '1.0.0' })
    })

    it('should return empty object for composables without meta', () => {
      const composable = () => ({})
      expect(extractComposableMeta(composable)).toEqual({})
    })

    it('should handle null input', () => {
      expect(extractComposableMeta(null)).toEqual({})
    })
  })

  describe('validateComposableOptions', () => {
    it('should validate options successfully', () => {
      const options = { name: 'useCounter', lazy: true }
      expect(validateComposableOptions(options)).toBe(true)
    })

    it('should reject invalid options', () => {
      expect(() => validateComposableOptions(null)).toThrow()
      expect(() => validateComposableOptions({ name: 123 })).toThrow()
      expect(() => validateComposableOptions({ invalid: true })).toThrow()
    })

    it('should validate required fields', () => {
      expect(() => validateComposableOptions({})).toThrow('name is required')
    })

    it('should validate option types', () => {
      expect(() => validateComposableOptions({ name: 'test', lazy: 'yes' })).toThrow()
    })
  })
})
