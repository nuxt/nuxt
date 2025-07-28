import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { loadNuxtConfig } from '@nuxt/kit'

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
        "#layers/layer-fixture": "<rootDir>/",
        "#layers/test": "<rootDir>/layers/test/",
        "#shared": "<rootDir>/shared/",
        "@": "<rootDir>/",
        "@@": "<rootDir>/",
        "~": "<rootDir>/",
        "~~": "<rootDir>/",
      }
    `)
  })
})
