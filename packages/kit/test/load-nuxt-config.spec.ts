import process from 'node:process'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import type { Nuxt } from '@nuxt/schema'
import { getLayerDirectories, loadNuxtConfig } from '@nuxt/kit'
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

  it('should order local layers listed in extends (alias path) above unlisted ones', async () => {
    const cwd = fileURLToPath(new URL('./layer-fixture', import.meta.url)).replace(/\\/g, '/')
    // `c` is listed in extends, so it outranks the unlisted (auto-scanned) `d`; external layers stay below
    const config = await loadNuxtConfig({ cwd, overrides: { extends: ['~/layers/c'] } })
    expect(config._layers.map(l => basename(l.cwd))).toMatchInlineSnapshot(`
      [
        "layer-fixture",
        "c",
        "d",
        "b",
        "a",
      ]
    `)
  })

  it('should order local layers by their position in extends (relative path)', async () => {
    const cwd = fileURLToPath(new URL('./layer-fixture', import.meta.url)).replace(/\\/g, '/')
    const config = await loadNuxtConfig({ cwd, overrides: { extends: ['./layers/c', './layers/d'] } })
    expect(config._layers.map(l => basename(l.cwd))).toMatchInlineSnapshot(`
      [
        "layer-fixture",
        "c",
        "d",
        "b",
        "a",
      ]
    `)
  })

  it('should not leak layer directory defaults into the merged Nuxt config', async () => {
    const tempDir = await mkdtemp(join(tmpdir(), 'nuxt-layer-dir-'))
    const layerDir = join(tempDir, 'layers/foo')
    await mkdir(layerDir, { recursive: true })
    await writeFile(join(tempDir, 'nuxt.config.ts'), 'export default defineNuxtConfig({})\n')
    await writeFile(join(layerDir, 'nuxt.config.ts'), `class Plugin {
      #value = 42
      read () { return this.#value }
    }
    const plugin = new Plugin()
    const hook = () => 42
    const shared = { value: 'shared' }
    const cycle = { value: 'cycle' }
    cycle.self = cycle

    export default defineNuxtConfig({
      future: { compatibilityVersion: 4 },
      dir: { app: 'custom-app' },
      srcDir: '.',
      imports: { scan: false },
      typescript: { strict: false },
      app: { head: { meta: [{ name: 'layer' }] } },
      experimental: { appManifest: false },
      hooks: { ready: hook },
      vite: {
        plugins: [plugin],
        sharedA: shared,
        sharedB: shared,
        cycle,
      },
    })\n`)

    try {
      const config = await loadNuxtConfig({ cwd: tempDir })
      const [rootDirectories, layerDirectories] = getLayerDirectories({ options: config } as Nuxt)

      expect(config.dir.app).toBe(join(tempDir, 'custom-app'))
      expect(config._layers[1]?.config.dir?.app).toBe(join(layerDir, 'custom-app'))
      expect(rootDirectories?.public).toBe(`${join(tempDir, 'public')}/`)
      expect(layerDirectories?.public).toBe(`${join(layerDir, 'public')}/`)

      const layerConfig = config._layers[1]?.config
      expect(layerConfig?.imports).toEqual({ scan: false })
      expect(layerConfig?.typescript).toEqual({ strict: false })
      expect(layerConfig?.app).toEqual({ head: { meta: [{ name: 'layer' }] } })
      expect(layerConfig?.experimental).toEqual({ appManifest: false })

      const vite = config.vite as any
      const layerVite = layerConfig?.vite as any
      expect(vite.sharedA).toBe(vite.sharedB)
      expect(vite.sharedA).not.toBe(layerVite.sharedA)
      expect(vite.cycle.self).toBe(vite.cycle)
      expect(vite.cycle).not.toBe(layerVite.cycle)
      expect(vite.plugins[0]).toBe(layerVite.plugins[0])
      expect(vite.plugins[0].read()).toBe(42)
      expect(config.hooks.ready).toBe(layerConfig?.hooks?.ready)
    } finally {
      await rm(tempDir, { recursive: true, force: true })
    }
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

  it('should preserve and resolve a custom env name', async () => {
    const cwd = fileURLToPath(new URL('./layer-fixture', import.meta.url)).replace(/\\/g, '/')
    const config = await loadNuxtConfig({ cwd, envName: 'staging' })
    expect(config.envName).toBe('staging')
  })
})
