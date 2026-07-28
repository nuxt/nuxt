import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import type { Nuxt } from '@nuxt/schema'
import { join } from 'pathe'
import type { Plugin as RollupPlugin } from 'rollup'
import type { Plugin as VitePlugin } from 'vite'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { SourcemapPreserverPlugin } from './sourcemap-preserver.ts'

interface NitroMock {
  options: { rollupConfig: { plugins?: RollupPlugin[] } }
}

describe('SourcemapPreserverPlugin', () => {
  const temporaryDirectories: string[] = []

  afterEach(async () => {
    await Promise.all(temporaryDirectories.splice(0).map(dir => rm(dir, { recursive: true, force: true })))
  })

  it('passes Vite server sourcemaps to the Nitro build', async () => {
    let nitroBuildBefore: ((nitro: NitroMock) => void) | undefined
    const nuxt = {
      options: {
        dev: false,
        sourcemap: { server: true },
      },
      hook (name: string, handler: (nitro: NitroMock) => void) {
        if (name === 'nitro:build:before') {
          nitroBuildBefore = handler
        }
      },
    } as unknown as Nuxt

    const vitePlugin = SourcemapPreserverPlugin(nuxt) as VitePlugin

    const outputDir = await mkdtemp(join(tmpdir(), 'nuxt-sourcemap-preserver-'))
    temporaryDirectories.push(outputDir)
    const serverEntry = join(outputDir, 'server.mjs')
    await writeFile(serverEntry, 'throw new Error("test")')

    const configResolved = vitePlugin.configResolved as (config: { build: { outDir: string } }) => void
    const writeBundle = vitePlugin.writeBundle as (options: object, bundle: Record<string, object>) => Promise<void>
    configResolved({ build: { outDir: outputDir } })
    await writeBundle({}, {
      'server.mjs': {
        type: 'chunk',
        fileName: 'server.mjs',
        map: {
          file: 'server.mjs',
          mappings: 'AAAA,MAAM,IAAI,MAAM,MAAM',
          names: ['Error'],
          sources: ['../../../app/app.vue'],
          sourcesContent: ['throw new Error("test")'],
          version: 3,
        },
      },
    })

    const nitro: NitroMock = {
      options: { rollupConfig: { plugins: [{ name: 'existing-plugin' }] } },
    }

    nitroBuildBefore!(nitro)

    expect(nitro.options.rollupConfig.plugins?.some(plugin => plugin.name === 'existing-plugin')).toBe(true)
    const nitroPlugin = nitro.options.rollupConfig.plugins?.find(plugin => plugin.load)
    expect(nitroPlugin).toBeDefined()
    if (!nitroPlugin) { return }

    const load = nitroPlugin.load as unknown as {
      filter: { id: RegExp }
      handler: (this: { warn: ReturnType<typeof vi.fn> }, id: string) => Promise<{ code: string, map: string }>
    }
    expect(load.filter.id.test(serverEntry)).toBe(true)

    const result = await load.handler.call({ warn: vi.fn() }, serverEntry)
    expect(result.code).toBe('throw new Error("test")')
    const returnedMap = JSON.parse(result.map)
    expect(returnedMap.mappings).toBe('AAAA,MAAM,IAAI,MAAM,MAAM')
    expect(returnedMap.sources).toEqual(['../../../app/app.vue'])

    const writtenMap = JSON.parse(await readFile(serverEntry + '.map.json', 'utf8'))
    expect(writtenMap.mappings).toBe('AAAA,MAAM,IAAI,MAAM,MAAM')
    expect(writtenMap.sources).toEqual(['../../../app/app.vue'])
    expect(writtenMap.sourcesContent).toEqual(['throw new Error("test")'])
  })
})
