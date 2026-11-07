import { fileURLToPath } from 'node:url'
import { describe, expect, it, vi } from 'vitest'
import { createServer } from 'vite'
import type { Plugin, ResolvedConfig } from 'vite'
import type { Nuxt } from '@nuxt/schema'
import { ensureDependencyInstalled } from '@nuxt/kit'

import { VitePluginCheckerPlugin } from '../src/plugins/vite-plugin-checker.ts'
import { TypeCheckPlugin } from '../src/plugins/type-check.ts'

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

vi.mock('@nuxt/kit', async importOriginal => ({
  ...await importOriginal<typeof import('@nuxt/kit')>(),
  ensureDependencyInstalled: vi.fn(() => Promise.resolve(true)),
}))

describe('vite-plugin-checker', () => {
  it('should not inject the checker runtime when the package is missing', async () => {
    vi.mocked<(name: string) => Promise<boolean>>(ensureDependencyInstalled).mockResolvedValueOnce(false)
    const nuxt = {
      options: {
        test: false,
        dev: true,
        rootDir: fileURLToPath(new URL('.', import.meta.url)),
        modulesDir: [],
        typescript: { typeCheck: true },
      },
    } as unknown as Nuxt

    const plugins = [await VitePluginCheckerPlugin(nuxt)].filter(Boolean) as Plugin[]
    const typeCheck = TypeCheckPlugin(nuxt)
    ;(typeCheck.configResolved as (config: ResolvedConfig) => void)({ plugins, environments: {}, build: { rolldownOptions: { input: '/entry.ts' } } } as unknown as ResolvedConfig)
    expect((typeCheck.transform as (code: string, id: string) => unknown)('', '/entry.ts')).toBeUndefined()
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
