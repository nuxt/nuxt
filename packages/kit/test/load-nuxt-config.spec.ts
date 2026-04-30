import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { loadNuxtConfig } from '@nuxt/kit'
import { basename } from 'pathe'

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

  describe('with NUXT_PORT/NUXT_HOST env vars', () => {
    const envKeys = ['NUXT_PORT', 'NUXT_HOST'] as const
    const original: Record<string, string | undefined> = {}

    beforeEach(() => {
      for (const key of envKeys) {
        original[key] = process.env[key]
      }
      process.env.NUXT_PORT = '3005'
      process.env.NUXT_HOST = '0.0.0.0'
    })

    afterEach(() => {
      for (const key of envKeys) {
        if (original[key] === undefined) {
          delete process.env[key]
        } else {
          process.env[key] = original[key]
        }
      }
    })

    // Regression test for #34955: env vars must be read at applyDefaults time,
    // not at schema module-import time, since the schema is loaded in parallel
    // with c12's loadConfig (which populates process.env from .env).
    it('should apply NUXT_PORT and NUXT_HOST env vars to devServer defaults', async () => {
      const cwd = fileURLToPath(new URL('./layer-fixture', import.meta.url)).replace(/\\/g, '/')
      const config = await loadNuxtConfig({ cwd })
      expect(config.devServer.port).toBe(3005)
      expect(config.devServer.host).toBe('0.0.0.0')
    })
  })
})
