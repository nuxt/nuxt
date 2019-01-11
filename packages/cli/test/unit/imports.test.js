import consola from 'consola'
import { importModule } from '../../src/imports'

describe('imports', () => {
  test('should import relative module', async () => {
    await expect(importModule('jest')).resolves.toBeDefined()
  })
  test('should import core module', async () => {
    await expect(importModule('path')).resolves.toBeDefined()
  })
  test('should print error when module not found', async () => {
    await expect(importModule('not-found-module')).resolves.toBeUndefined()
    expect(consola.fatal).toHaveBeenCalled()
    expect(consola.fatal).toHaveBeenCalledWith(
      `Module not-found-module not found.\n\n`,
      `Please install missing dependency:\n\n`,
      `Using npm:  npm i not-found-module\n\n`,
      `Using yarn: yarn add not-found-module`
    )
  })
  test('should throw error when error is not module not found', async () => {
    await expect(importModule('jest/README.md')).rejects.toThrow()
  })
})
