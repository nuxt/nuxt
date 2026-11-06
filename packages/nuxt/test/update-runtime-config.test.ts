import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'
import { join } from 'pathe'
import { describe, expect, it } from 'vitest'
import { tryUseNitro, updateRuntimeConfig } from '@nuxt/kit'
import { loadNuxt } from '../src/index.ts'

const fixtureDir = fileURLToPath(new URL('./modules-fixture', import.meta.url))

describe('updateRuntimeConfig', () => {
  it('should keep the existing nitro runtime config', async () => {
    const buildDir = await mkdtemp(join(tmpdir(), 'nuxt-update-runtime-config-'))
    const nuxt = await loadNuxt({ cwd: fixtureDir, ready: true, overrides: { buildDir } })
    try {
      const nitro = nuxt.runWithContext(() => tryUseNitro())!
      const before = structuredClone(nitro.options.runtimeConfig)
      expect(before).toMatchObject({
        public: expect.any(Object),
        appSecret: expect.any(String),
        nitro: { envPrefix: 'NUXT_', routeRules: expect.objectContaining({ '/__nuxt_error': expect.any(Object) }) },
      })

      await nuxt.runWithContext(() => updateRuntimeConfig({ foo: 'bar' }))

      expect(nitro.options.runtimeConfig).toEqual({ ...before, foo: 'bar' })
    } finally {
      await nuxt.close()
      await rm(buildDir, { recursive: true, force: true })
    }
  })
})
