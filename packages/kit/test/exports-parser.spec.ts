import { fileURLToPath } from 'node:url'
import { afterEach, describe, expect, it, vi } from 'vitest'

const fixture = fileURLToPath(new URL('./exports-fixture/index.ts', import.meta.url))

async function importFresh () {
  vi.resetModules()
  const { resolveModuleExportNames } = await import('../src/internal/exports.ts')
  return resolveModuleExportNames
}

describe('parser resolution', () => {
  afterEach(() => {
    vi.doUnmock('rolldown/utils')
    vi.doUnmock('oxc-parser')
    vi.doUnmock('mlly')
  })

  it('should resolve export names through `rolldown/utils`', async () => {
    const resolveModuleExportNames = await importFresh()
    await expect(resolveModuleExportNames(fixture)).resolves.toContain('fromStar')
  })

  it('should fall back to `oxc-parser` when `rolldown` is not installed', async () => {
    vi.doMock('rolldown/utils', () => { throw new Error('Cannot find package \'rolldown\'') })

    const resolveModuleExportNames = await importFresh()
    await expect(resolveModuleExportNames(fixture)).resolves.toContain('fromStar')
  })

  it('should fall back to `mlly` when no oxc parser is installed', async () => {
    vi.doMock('rolldown/utils', () => { throw new Error('Cannot find package \'rolldown\'') })
    vi.doMock('oxc-parser', () => { throw new Error('Cannot find package \'oxc-parser\'') })

    const resolveModuleExportNames = await importFresh()
    await expect(resolveModuleExportNames(fixture)).resolves.toContain('fromStar')
  })

  it('should throw a diagnostic when no parser is available', async () => {
    vi.doMock('rolldown/utils', () => { throw new Error('Cannot find package \'rolldown\'') })
    vi.doMock('oxc-parser', () => { throw new Error('Cannot find package \'oxc-parser\'') })
    vi.doMock('mlly', () => { throw new Error('Cannot find package \'mlly\'') })

    const resolveModuleExportNames = await importFresh()
    await expect(resolveModuleExportNames(fixture)).rejects.toThrow(/needs a parser/)
  })
})
