import { describe, expect, it } from 'vitest'
import { NUXT_ERROR_SIGNATURE, createError, isNuxtError } from '../src/app/composables/error'

describe('NuxtError', () => {
  describe('toJSON', () => {
    it('should include __nuxt_error in serialized output', () => {
      const error = createError({ message: 'Test error', statusCode: 404 })
      const json = error.toJSON()

      expect(json).toHaveProperty('__nuxt_error', true)
      expect(NUXT_ERROR_SIGNATURE in json).toBe(true)
    })

    it('should include fatal in serialized output', () => {
      const error = createError({ message: 'Test error', statusCode: 404 })
      const json = error.toJSON()

      expect(json).toHaveProperty('fatal')
      expect(typeof json.fatal).toBe('boolean')
    })

    it('should include HTTPError properties in serialized output', () => {
      const error = createError({ message: 'Test error', statusCode: 404, statusText: 'Not Found' })
      const json = error.toJSON()

      expect(json.status).toBe(404)
      expect(json.statusText).toBe('Not Found')
      expect(json.message).toBe('Test error')
    })
  })

  describe('isNuxtError', () => {
    it('should return true for a NuxtError instance', () => {
      const error = createError('Test error')
      expect(isNuxtError(error)).toBe(true)
    })

    it('should return true for a serialized NuxtError', () => {
      const error = createError('Test error')
      const json = error.toJSON()
      expect(isNuxtError(json)).toBe(true)
    })

    it('should return false for a plain object', () => {
      expect(isNuxtError({ message: 'Test' })).toBe(false)
    })

    it('should return false for a regular Error', () => {
      expect(isNuxtError(new Error('Test'))).toBe(false)
    })
  })

  describe('payload revival', () => {
    it('should revive with isNuxtError returning true', () => {
      const error = createError({ message: 'Test error', statusCode: 500, fatal: true })
      const json = error.toJSON()
      const revived = createError(json as any)

      expect(isNuxtError(revived)).toBe(true)
    })

    it('should preserve fatal through serialization and revival', () => {
      const error = createError({ message: 'Test error', statusCode: 500, fatal: true })
      const json = error.toJSON()
      const revived = createError(json as any)

      expect(revived.fatal).toBe(true)
    })

    it('should preserve data through serialization and revival', () => {
      const customData = { foo: 'bar', baz: 123 }
      const error = createError({ message: 'Test error', data: customData })
      const json = error.toJSON()
      const revived = createError(json as any)

      expect(revived.data).toEqual(customData)
    })
  })
})
