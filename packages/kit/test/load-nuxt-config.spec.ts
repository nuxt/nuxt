import process from 'node:process'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
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

  describe('with .env file', () => {
    let tempDir: string

    beforeAll(async () => {
      tempDir = await mkdtemp(join(tmpdir(), 'nuxt-loadConfig-'))
      await writeFile(join(tempDir, '.env'), 'NUXT_PORT=3005\nNUXT_HOST=0.0.0.0\n')
    })

    afterAll(async () => {
      delete process.env.NUXT_PORT
      delete process.env.NUXT_HOST
      vi.restoreAllMocks()
      await rm(tempDir, { recursive: true, force: true })
    })

    it('should apply NUXT_PORT and NUXT_HOST from .env to devServer defaults', async () => {
      vi.resetModules()
      // delay c12 so the schema import wins the race (#34955 repro)
      vi.doMock('c12', async () => {
        const actual = await vi.importActual<typeof import('c12')>('c12')
        return {
          ...actual,
          loadConfig: async (opts: Parameters<typeof actual.loadConfig>[0]) => {
            await new Promise(resolve => setTimeout(resolve, 50))
            return actual.loadConfig(opts)
          },
        }
      })

      const { loadNuxtConfig } = await import('@nuxt/kit')
      const config = await loadNuxtConfig({ cwd: tempDir })
      expect(config.devServer.port).toBe(3005)
      expect(config.devServer.host).toBe('0.0.0.0')
    })
  })
})
