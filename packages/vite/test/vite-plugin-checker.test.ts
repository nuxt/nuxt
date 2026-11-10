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
    [true, true, false, true],
    [true, false, false, true],
    ['build', true, false, false],
    ['build', false, false, true],
    ['dev', true, false, true],
    ['dev', false, false, false],
    [false, true, false, false],
    [false, false, false, false],
    [true, true, true, false],
    ['build', false, true, false],
    ['dev', true, true, false],
  ] as const)('typeCheck: %s, dev: %s, test: %s -> enabled: %s', async (typeCheck, dev, test, enabled) => {
    const nuxt = {
      options: {
        test,
        dev,
        rootDir: fileURLToPath(new URL('.', import.meta.url)),
        typescript: { typeCheck },
      },
    } as unknown as Nuxt

    expect(!!(await VitePluginCheckerPlugin(nuxt))).toBe(enabled)
  })

  it('should import the checker runtime into the client entry in development', async () => {
    const nuxt = {
      options: {
        test: false,
        dev: true,
        rootDir: fileURLToPath(new URL('.', import.meta.url)),
        typescript: { typeCheck: true },
      },
    } as unknown as Nuxt

    const runtime = (await VitePluginCheckerPlugin(nuxt))!.find(plugin => plugin.name === 'nuxt:type-check')!
    const applies = runtime.applyToEnvironment as (environment: unknown) => boolean
    expect(applies({ name: 'client', config: { isProduction: false } })).toBe(true)
    expect(applies({ name: 'client', config: { isProduction: true } })).toBe(false)
    expect(applies({ name: 'ssr', config: { isProduction: false } })).toBe(false)

    const configResolved = runtime.configResolved as (config: unknown) => void
    configResolved({ environments: { client: { build: { rolldownOptions: { input: '/entry.js' } } } } })
    const transform = runtime.transform as (code: string, id: string) => { code: string } | undefined
    expect(transform('export default 1', '/entry.js?import')?.code).toBe('import "/@vite-plugin-checker-runtime-entry";\nexport default 1')
    expect(transform('export default 1', '/other.js')).toBeUndefined()
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
