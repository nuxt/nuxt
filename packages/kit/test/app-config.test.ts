import { afterAll, describe, expect, it } from 'vitest'
import { loadNuxt, updateAppConfig } from '../src/index.ts'
import { join } from 'pathe'
import { fileURLToPath } from 'node:url'
import { dirname } from 'node:path'
import { rm } from 'node:fs/promises'

const __dirname = dirname(fileURLToPath(import.meta.url))

describe('updateAppConfig', { sequential: true }, () => {
  const tempDir = join(__dirname, '..', '..', 'temp', 'app-config-test')

  it('merges appConfig deeply', async () => {
    const nuxt = await loadNuxt({
      cwd: tempDir,
      overrides: {
        appConfig: {
          existing: 'value',
          nested: { key: 'original' },
        },
      },
    })

    updateAppConfig({
      new: 'value',
      nested: { anotherKey: 'new' },
    })

    expect(nuxt.options.appConfig).toMatchObject({
      existing: 'value',
      new: 'value',
      nested: {
        key: 'original',
        anotherKey: 'new',
      },
    })

    await nuxt.close()
  })

  it('overwrites existing values with new values', async () => {
    const nuxt = await loadNuxt({
      cwd: tempDir,
      overrides: {
        appConfig: {
          existing: 'original',
        },
      },
    })

    updateAppConfig({
      existing: 'updated',
    })

    expect(nuxt.options.appConfig.existing).toBe('updated')

    await nuxt.close()
  })

  it('preserves keys not in update', async () => {
    const nuxt = await loadNuxt({
      cwd: tempDir,
      overrides: {
        appConfig: {
          keepThis: 'value',
        },
      },
    })

    updateAppConfig({
      newKey: 'newValue',
    })

    expect(nuxt.options.appConfig.keepThis).toBe('value')
    expect(nuxt.options.appConfig.newKey).toBe('newValue')

    await nuxt.close()
  })

  afterAll(async () => {
    await rm(tempDir, { recursive: true, force: true })
  })
})
