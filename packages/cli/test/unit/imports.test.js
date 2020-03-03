import { importModule } from '../../src/imports'

describe('imports', () => {
  test('should import relative module', async () => {
    await expect(importModule('jest')).resolves.toBeDefined()
  })
  test('should import core module', async () => {
    await expect(importModule('path')).resolves.toBeDefined()
  })
  test('should throw error with proper code when module not found', async () => {
    await expect(importModule('not-found-module')).rejects.toMatchObject({
      message: 'Cannot import module \'not-found-module\'',
      code: 'MODULE_NOT_FOUND'
    })
  })
  test('should throw error when error is not module not found', async () => {
    await expect(importModule('jest/README.md')).rejects.toThrow()
  })
})
