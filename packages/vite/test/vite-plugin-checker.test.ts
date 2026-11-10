import { fileURLToPath } from 'node:url'
import { describe, expect, it, vi } from 'vitest'
import { createServer } from 'vite'
import type { Plugin } from 'vite'
import type { Nuxt } from '@nuxt/schema'

import { VitePluginCheckerPlugin } from '../src/plugins/vite-plugin-checker.ts'

const workers = new Set<object>()

vi.mock('vite-plugin-checker', () => ({
  default: (): Plugin => {
    const worker = {}
    return {
      name: 'vite-plugin-checker',
      config () {
        workers.add(worker)
      },
      buildEnd () {
        workers.delete(worker)
      },
    }
  },
}))

describe('vite-plugin-checker', () => {
  it.each([
    [true, true, true],
    [true, false, true],
    ['build', true, false],
    ['build', false, true],
    ['dev', true, true],
    ['dev', false, false],
    [false, true, false],
    [false, false, false],
  ] as const)('typeCheck: %s, dev: %s -> enabled: %s', async (typeCheck, dev, enabled) => {
    const nuxt = {
      options: {
        test: false,
        dev,
        rootDir: fileURLToPath(new URL('.', import.meta.url)),
        typescript: { typeCheck },
      },
    } as unknown as Nuxt

    expect(!!(await VitePluginCheckerPlugin(nuxt))).toBe(enabled)
  })

  it('should not enable type checking in test mode', async () => {
    for (const typeCheck of [true, 'build', 'dev'] as const) {
      for (const dev of [true, false]) {
        const nuxt = {
          options: { test: true, dev, typescript: { typeCheck } },
        } as unknown as Nuxt
        expect(await VitePluginCheckerPlugin(nuxt)).toBeUndefined()
      }
    }
  })

  it('should terminate every checker worker when the dev server closes', async () => {
    const nuxt = {
      options: {
        test: false,
        dev: true,
        ssr: true,
        rootDir: fileURLToPath(new URL('.', import.meta.url)),
        typescript: { typeCheck: true },
      },
    } as unknown as Nuxt

    const server = await createServer({
      configFile: false,
      logLevel: 'silent',
      server: { middlewareMode: true, ws: false },
      environments: {
        client: {},
        ssr: {},
      },
      plugins: [VitePluginCheckerPlugin(nuxt)],
    })

    expect(workers.size).toBeGreaterThan(0)
    await server.close()
    expect(workers.size).toBe(0)
  })
})
