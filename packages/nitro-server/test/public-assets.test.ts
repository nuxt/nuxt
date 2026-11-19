import { mkdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { describe, expect, it, onTestFinished, vi } from 'vitest'
import { resolve } from 'pathe'
import { loadNuxt } from '@nuxt/kit'
import type { Nuxt, NuxtConfig } from '@nuxt/schema'
import type { Nitro } from 'nitro/types'

vi.mock('@nuxt/kit/internal', async importOriginal => ({
  ...await importOriginal<typeof import('@nuxt/kit/internal')>(),
  bundlerDiagnostics: { NUXT_B7023: vi.fn() },
}))

const { bundlerDiagnostics } = await import('@nuxt/kit/internal')

const fixtureDir = resolve(import.meta.dirname, '../../../test/fixtures/minimal')

function assetsDir () {
  const dir = resolve(tmpdir(), `nuxt-public-assets-${Date.now()}-${Math.random().toString(36).slice(2)}`)
  onTestFinished(() => rmSync(dir, { recursive: true, force: true }))
  return dir
}

function warnings () {
  return vi.mocked(bundlerDiagnostics.NUXT_B7023).mock.calls.map(call => call[0])
}

async function withNitro (config: NuxtConfig, fn: (nitro: Nitro, nuxt: Nuxt) => Promise<void> | void) {
  let nitro: Nitro
  const nuxt = await loadNuxt({
    cwd: fixtureDir,
    dev: config.dev,
    ready: true,
    overrides: {
      ...config,
      _nitroMajor: 3,
      hooks: {
        'nitro:init' (_nitro) {
          nitro = _nitro
        },
      },
    },
  })
  try {
    await fn(nitro!, nuxt)
  } finally {
    await nuxt.close()
  }
}

describe('nitro publicAssets diagnostics', () => {
  it('does not warn when nothing serves or copies public assets', async () => {
    vi.mocked(bundlerDiagnostics.NUXT_B7023).mockClear()
    await withNitro({
      nitro: { publicAssets: [{ dir: assetsDir(), baseURL: '/assets' }] },
    }, () => {
      expect(warnings()).toEqual([])
    })
  })

  it('does not warn when a module creates the directory in `nitro:build:before`', async () => {
    vi.mocked(bundlerDiagnostics.NUXT_B7023).mockClear()
    const dir = assetsDir()
    await withNitro({
      nitro: { publicAssets: [{ dir, baseURL: '/assets' }] },
      modules: [(_options: unknown, nuxt: Nuxt) => {
        nuxt.hook('nitro:build:before', () => { mkdirSync(dir, { recursive: true }) })
      }],
    }, async (nitro, nuxt) => {
      await nuxt.callHook('nitro:build:before', nitro)
      await nitro.hooks.callHook('build:config', nitro, { builder: 'vite', rollup: {} } as never)
      expect(warnings()).toEqual([])
    })
  })

  it('warns once when a publicAssets directory never exists', async () => {
    vi.mocked(bundlerDiagnostics.NUXT_B7023).mockClear()
    const dir = assetsDir()
    await withNitro({
      nitro: { publicAssets: [{ dir, baseURL: '/assets' }] },
    }, async (nitro) => {
      await nitro.hooks.callHook('build:config', nitro, { builder: 'vite', rollup: {} } as never)
      expect(warnings()).toEqual([{
        dir,
        baseURL: '/assets/**',
        resolvedFrom: 'your project root',
      }])
    })
  })
})
