import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
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

  it('should discover layers from an extended config', async () => {
    const baseCwd = fileURLToPath(new URL('./layer-extends-fixture', import.meta.url)).replace(/\\/g, '/')
    const cwd = fileURLToPath(new URL('./layer-extends-fixture/app', import.meta.url)).replace(/\\/g, '/')
    const config = await loadNuxtConfig({ cwd })

    const layerNames = config._layers.map(l => basename(l.cwd))
    expect(layerNames).toContain('test-layer')

    expect(config.alias['#layers/test-layer']).toBe(baseCwd + '/layers/test-layer/')
  })

  it('should discover nested layers inside a layer', async () => {
    const cwd = fileURLToPath(new URL('./layer-nested-fixture', import.meta.url)).replace(/\\/g, '/')
    const config = await loadNuxtConfig({ cwd })

    const layerNames = config._layers.map(l => basename(l.cwd))
    expect(layerNames).toContain('a')
    expect(layerNames).toContain('b')

    expect(config.alias['#layers/a']).toBe(cwd + '/layers/a/')
    expect(config.alias['#layers/b']).toBe(cwd + '/layers/a/layers/b/')
  })
})
