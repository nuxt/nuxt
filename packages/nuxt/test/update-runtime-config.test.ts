import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'
import { join } from 'pathe'
import { describe, expect, it, vi } from 'vitest'
import { tryUseNitro, updateRuntimeConfig } from '@nuxt/kit'
import { configDiagnostics, getRuntimeConfigSchema } from '@nuxt/kit/internal'
import { z } from 'zod'
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

  it('should let a module set a schema, which later modules read as plain values', async () => {
    const buildDir = await mkdtemp(join(tmpdir(), 'nuxt-update-runtime-config-'))
    let read: unknown
    const nuxt = await loadNuxt({
      cwd: fixtureDir,
      ready: true,
      overrides: {
        buildDir,
        runtimeConfig: { myModule: { apiKey: 'user' } },
        modules: [
          () => updateRuntimeConfig({ myModule: z.object({ apiKey: z.string(), retries: z.number().default(3) }) }),
          (_options, nuxt) => { read = structuredClone(nuxt.options.runtimeConfig.myModule) },
        ],
      },
    })
    try {
      expect(read).toEqual({ apiKey: 'user', retries: 3 })
      expect(getRuntimeConfigSchema(nuxt.options.runtimeConfig, nuxt.options._runtimeConfigSchemas).p.myModule).toEqual({
        p: { apiKey: 's', retries: 'n' },
        r: ['apiKey', 'retries'],
      })
    } finally {
      await nuxt.close()
      await rm(buildDir, { recursive: true, force: true })
    }
  })

  it.each([false, true])('should warn about invalid environment variables unless preparing (%s)', async (_prepare) => {
    const buildDir = await mkdtemp(join(tmpdir(), 'nuxt-update-runtime-config-'))
    const warn = vi.spyOn(configDiagnostics, 'NUXT_B5032').mockImplementation(() => undefined as any)
    vi.stubEnv('NUXT_CONFIG_TEST_PORT', 'abc')
    const nuxt = await loadNuxt({ cwd: fixtureDir, ready: true, overrides: { buildDir, _prepare, runtimeConfig: { configTestPort: z.number().default(3000) } } })
    try {
      if (_prepare) {
        expect(warn).not.toHaveBeenCalled()
      } else {
        expect(warn).toHaveBeenCalledWith({ issues: '`configTestPort` (`NUXT_CONFIG_TEST_PORT`) must be number, but received a string.' })
      }
    } finally {
      warn.mockRestore()
      vi.unstubAllEnvs()
      await nuxt.close()
      await rm(buildDir, { recursive: true, force: true })
    }
  })

  it('should throw when a module assigns a schema to the runtime config', async () => {
    const buildDir = await mkdtemp(join(tmpdir(), 'nuxt-update-runtime-config-'))
    try {
      await expect(loadNuxt({
        cwd: fixtureDir,
        ready: true,
        overrides: {
          buildDir,
          modules: [(_options, nuxt) => { nuxt.options.runtimeConfig.public.token = z.string() as any }],
        },
      })).rejects.toThrow('`runtimeConfig.public.token` is a schema, but schemas can only be declared in `nuxt.config` or with `updateRuntimeConfig()`.')
    } finally {
      await rm(buildDir, { recursive: true, force: true })
    }
  })
})
