import { fileURLToPath } from 'node:url'
import process from 'node:process'
import { describe, expect, it } from 'vitest'
import { rmSync, writeFileSync } from 'node:fs'
import { loadNuxtConfig } from '@nuxt/kit'
import { basename, join } from 'pathe'

describe('loadNuxtConfig', () => {
  it('should add named aliases for local layers', async () => {
    const cwd = fileURLToPath(new URL('./layer-fixture', import.meta.url)).replace(/\\/g, '/')
    const config = await loadNuxtConfig({ cwd })
    for (const alias in config.alias) {
      config.alias[alias] = config.alias[alias]!.replace(cwd, '<rootDir>')
    }
    expect(config.alias).toMatchInlineSnapshot(`
      {
        "#build": "<rootDir>/.nuxt/",
        "#internal/nuxt/paths": "<rootDir>/.nuxt/paths.mjs",
        "#layers/c": "<rootDir>/layers/c/",
        "#layers/d": "<rootDir>/layers/d/",
        "#layers/layer-fixture": "<rootDir>/",
        "#server": "<rootDir>/server/",
        "#shared": "<rootDir>/shared/",
        "@": "<rootDir>/",
        "@@": "<rootDir>/",
        "~": "<rootDir>/",
        "~~": "<rootDir>/",
      }
    `)
  })

  it('should respect alphabetical order of local layers', async () => {
    const cwd = fileURLToPath(new URL('./layer-fixture', import.meta.url)).replace(/\\/g, '/')
    const config = await loadNuxtConfig({ cwd })
    // priority list
    // 1. layers in nuxt.config (first overrides second)
    // 2. then local layers in alphabetical order (Z overrides A)
    // 3. local project overrides
    expect(config._layers.map(l => basename(l.cwd))).toMatchInlineSnapshot(`
      [
        "layer-fixture",
        "d",
        "c",
        "b",
        "a",
      ]
    `)
  })

  it('should expand environment variables from files', async () => {
    const cwd = fileURLToPath(new URL('./layer-fixture', import.meta.url))
    const secretFile = join(cwd, 'secret.txt')
    writeFileSync(secretFile, 'secret-value')
    process.env.TEST_SECRET_FILE = secretFile

    const secretFileExisting = join(cwd, 'secret-existing.txt')
    writeFileSync(secretFileExisting, 'new-value')
    process.env.TEST_SECRET_EXISTING_FILE = secretFileExisting
    process.env.TEST_SECRET_EXISTING = 'existing-value'

    await loadNuxtConfig({ cwd })

    expect(process.env.TEST_SECRET).toBe('secret-value')
    expect(process.env.TEST_SECRET_EXISTING).toBe('existing-value')

    delete process.env.TEST_SECRET_FILE
    delete process.env.TEST_SECRET
    rmSync(secretFile)

    delete process.env.TEST_SECRET_EXISTING_FILE
    delete process.env.TEST_SECRET_EXISTING
    rmSync(secretFileExisting)
  })
})
