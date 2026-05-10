import process from 'node:process'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { join } from 'pathe'

describe('loadNuxtConfig', () => {
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
