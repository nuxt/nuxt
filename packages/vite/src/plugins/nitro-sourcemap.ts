import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'pathe'

import type { Plugin as RollupPlugin } from 'rollup'
import type { Plugin as VitePlugin } from 'vite'

export const createSourcemapPreserver = () => {
  let outputDir: string
  const ids = new Set<string>()

  const vitePlugin = {
    name: 'nuxt:sourcemap-export',
    configResolved (config) {
      outputDir = config.build.outDir
    },
    async writeBundle (_options, bundle) {
      for (const chunk of Object.values(bundle)) {
        if (chunk.type !== 'chunk' || !chunk.map) { continue }

        const id = resolve(outputDir, chunk.fileName)
        ids.add(id)
        const dest = id + '.map.json'
        await mkdir(dirname(dest), { recursive: true })
        await writeFile(dest, JSON.stringify({
          file: chunk.map.file,
          mappings: chunk.map.mappings,
          names: chunk.map.names,
          sources: chunk.map.sources,
          sourcesContent: chunk.map.sourcesContent,
          version: chunk.map.version,
        }))
      }
    },
  } satisfies VitePlugin

  const nitroPlugin = {
    name: 'nuxt:sourcemap-import',
    async load (id) {
      id = resolve(id)
      if (!ids.has(id)) { return }

      const [code, map] = await Promise.all([
        readFile(id, 'utf-8').catch(() => undefined),
        readFile(id + '.map.json', 'utf-8').catch(() => undefined),
      ])

      if (!code) {
        this.warn('Failed loading file')
        return null
      }

      return {
        code,
        map,
      }
    },
  } satisfies RollupPlugin

  return {
    vitePlugin,
    nitroPlugin,
  }
}
