import { describe, expect, it } from 'vitest'
import { NUXT_ERROR_SIGNATURE, createError, isNuxtError } from '../src/app/composables/error'

describe('NuxtError', () => {
  describe('payload serialization', () => {
    it('should include __nuxt_error in payload when serialized via reducer', () => {
      const error = createError({ message: 'Test error', status: 500, statusText: 'Internal Server Error' })
      const json = error.toJSON()

      const reduced = { ...json, [NUXT_ERROR_SIGNATURE]: true }

      expect(reduced).toHaveProperty('__nuxt_error', true)
      expect(NUXT_ERROR_SIGNATURE in reduced).toBe(true)
    })

    it('should pass isNuxtError check after reducer adds __nuxt_error', () => {
      const error = createError('Test error')
      const json = error.toJSON()

      const reduced = { ...json, [NUXT_ERROR_SIGNATURE]: true }

      expect(isNuxtError(reduced)).toBe(true)
    })

    it('should revive correctly after reducer serialization', () => {
      const error = createError({ message: 'Test error', status: 500, statusText: 'Internal Server Error' })
      const json = error.toJSON()

      const reduced = { ...json, [NUXT_ERROR_SIGNATURE]: true }
      const revived = createError(reduced as any)

      expect(isNuxtError(revived)).toBe(true)
      expect(revived.status).toBe(500)
    })
  })

  describe('isNuxtError', () => {
    it('should return true for a NuxtError instance', () => {
      const error = createError('Test error')
      expect(isNuxtError(error)).toBe(true)
    })

    it('should return false for a plain object', () => {
      expect(isNuxtError({ message: 'Test' })).toBe(false)
    })

    it('should return false for a regular Error', () => {
      expect(isNuxtError(new Error('Test'))).toBe(false)
    })
  })

  describe('createError', () => {
    it('should create an error with status and statusText', () => {
      const error = createError({ message: 'Test error', status: 404, statusText: 'Not Found' })
      expect(error.status).toBe(404)
      expect(error.statusText).toBe('Not Found')
    })

    it('should preserve data', () => {
      const customData = { foo: 'bar' }
      const error = createError({ message: 'Test', data: customData } as any)
      expect(error.data).toEqual(customData)
    })
  })
})
