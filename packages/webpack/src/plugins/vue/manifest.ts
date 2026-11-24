/**
 * This file is based on Vue.js (MIT) webpack plugins
 * https://github.com/vuejs/vue/blob/dev/src/server/webpack-plugin/client.js
 */

import { mkdir, writeFile } from 'node:fs/promises'

import type { Nuxt } from '@nuxt/schema'
import { hash } from 'ohash'
import { join, resolve } from 'pathe'
import { serialize } from 'seroval'
import { normalizeWebpackManifest, precomputeDependencies } from 'vue-bundle-renderer'

import { getModuleIdentifier } from '../../loaders/vue-module-identifier.ts'
import { isCSS, isHotUpdate, isJS } from './util.ts'

interface StatsChunk {
  id?: string | number | null
  files?: string[]
  names?: string[]
}

interface StatsModule {
  identifier?: string
  chunks?: Array<string | number> | null
  assets?: Array<string | number>
  modules?: StatsModule[]
}

/** The subset of the webpack and Rspack JSON stats the client manifest is generated from. */
export interface ClientManifestStats {
  publicPath?: string
  entrypoints?: Record<string, { assets?: Array<{ name: string }> }>
  namedChunkGroups?: Record<string, { assets?: Array<{ name: string }> }>
  assets?: Array<{ name: string, chunkNames?: Array<string | number | null> }>
  chunks?: StatsChunk[]
  modules?: StatsModule[]
}

export const clientManifestStatsOptions = {
  modules: true,
  assets: true,
  chunks: true,
  chunkGroups: true,
  entrypoints: true,
}

/**
 * Generate the client manifest from the stats of the client build, expose it as a build output
 * and write it next to the server build when the build cache is enabled.
 */
export function createClientManifestEmitter (nuxt: Nuxt) {
  const serverDist = resolve(nuxt.options.buildDir, 'dist/server')
  let precomputedCode = 'export default undefined'
  let manifestCode: string | undefined

  nuxt.buildOutputs.clientManifest = () => manifestCode || 'export default {}'
  nuxt.buildOutputs.clientPrecomputed = () => precomputedCode

  return async (stats: ClientManifestStats) => {
    const manifest = normalizeWebpackManifest(createWebpackManifest(stats, nuxt.options.srcDir) as any)
    await nuxt.callHook('build:manifest', manifest)
    precomputedCode = 'export default ' + serialize(precomputeDependencies(manifest))
    manifestCode = 'export default ' + serialize(manifest)

    if (!nuxt.options.dev && nuxt.options.experimental.buildCache) {
      await mkdir(serverDist, { recursive: true })
      await writeFile(join(serverDist, 'client.manifest.mjs'), manifestCode, 'utf8')
      await writeFile(join(serverDist, 'client.precomputed.mjs'), precomputedCode, 'utf8')
    }
  }
}

function getModuleId (identifier: string, context: string): string {
  const id = identifier.replace(/\s\w+$/, '') // remove appended hash
  // Module identifier format: /path/loaders!resource?query
  // (the match is anchored to the start of a segment, as identifiers include a long chain of loaders)
  const resourceMatch = id.match(/(?:^|!)([^!]*\.vue)(?:\?|$)/)
  return resourceMatch && resourceMatch[1]
    ? getModuleIdentifier(resourceMatch[1], context)
    : id
}

function createWebpackManifest (stats: ClientManifestStats, context: string) {
  const initialFiles = new Set<string>()
  for (const { assets } of Object.values(stats.entrypoints!)) {
    if (!assets) { continue }

    for (const asset of assets) {
      const file = asset.name
      if ((isJS(file) || isCSS(file)) && !isHotUpdate(file)) {
        initialFiles.add(file)
      }
    }
  }

  const allFiles = new Set<string>()
  const asyncFiles = new Set<string>()
  const assetsMapping: Record<string, string[]> = {}

  for (const { name: file, chunkNames = [] } of stats.assets!) {
    if (isHotUpdate(file)) { continue }
    allFiles.add(file)
    const isFileJS = isJS(file)
    if (!initialFiles.has(file) && (isFileJS || isCSS(file))) {
      asyncFiles.add(file)
    }
    if (isFileJS) {
      const componentHash = hash(chunkNames.join('|'))
      const map = assetsMapping[componentHash] ||= []
      map.push(file)
    }
  }

  const webpackManifest = {
    publicPath: stats.publicPath,
    all: [...allFiles],
    initial: [...initialFiles],
    async: [...asyncFiles],
    modules: { /* [identifier: string]: Array<index: number> */ } as Record<string, number[]>,
    assetsMapping,
  }

  const { entrypoints = {}, namedChunkGroups = {} } = stats
  const fileToIndex = (file: string | number) => webpackManifest.all.indexOf(String(file))
  const chunksById = new Map(stats.chunks!.map(chunk => [chunk.id, chunk]))
  const assetModules = stats.modules!.filter(module => module.assets?.length)
  for (const m of stats.modules!) {
    // Ignore modules duplicated in multiple chunks
    if (m.chunks?.length !== 1) { continue }

    const [cid] = m.chunks
    const chunk = chunksById.get(cid)
    if (!chunk || !chunk.files || cid == null) {
      continue
    }
    const relativeId = getModuleId(m.identifier!, context)

    const filesSet = new Set<number>()
    for (const file of chunk.files) {
      const index = fileToIndex(file)
      if (index !== -1) {
        filesSet.add(index)
      }
    }

    for (const chunkName of chunk.names!) {
      if (!entrypoints[chunkName]) {
        const chunkGroup = namedChunkGroups[chunkName]
        if (chunkGroup) {
          for (const asset of chunkGroup.assets!) {
            filesSet.add(fileToIndex(asset.name))
          }
        }
      }
    }

    const files = Array.from(filesSet)
    webpackManifest.modules[relativeId] = files

    // In production mode, modules may be concatenated by scope hoisting
    // Include ConcatenatedModule for not losing module-component mapping
    if (Array.isArray(m.modules)) {
      for (const concatenatedModule of m.modules) {
        const relativeId = getModuleId(concatenatedModule.identifier!, context)
        webpackManifest.modules[relativeId] ||= files
      }
    }

    for (const module of assetModules) {
      if (module.chunks?.includes(cid)) {
        files.push(...module.assets!.map(fileToIndex))
      }
    }
  }

  return webpackManifest
}
