/**
 * The client manifest is based on Vue.js (MIT) webpack plugins
 * https://github.com/vuejs/vue/blob/dev/src/server/webpack-plugin/client.js
 */

import { mkdir, writeFile } from 'node:fs/promises'

import type { Nuxt } from '@nuxt/schema'
import type { RsbuildPlugin, Rspack } from '@rsbuild/core'
import { setBuildOutput } from '@nuxt/kit'
import { hash } from 'ohash'
import { join, normalize, relative, resolve } from 'pathe'
import { serialize } from 'seroval'
import { normalizeWebpackManifest, precomputeDependencies } from 'vue-bundle-renderer'

const JS_RE = /\.[cm]?js(?:\?[^.]+)?$/
const CSS_RE = /\.css(?:\?[^.]+)?$/

const isJS = (file: string) => JS_RE.test(file)
const isCSS = (file: string) => CSS_RE.test(file)
const isHotUpdate = (file: string) => file.includes('hot-update')

/**
 * Generate the client manifest used by `vue-bundle-renderer` to render resource hints
 * for the components rendered on the server.
 */
export function VueSSRPlugin (nuxt: Nuxt): RsbuildPlugin {
  return {
    name: 'nuxt:vue-ssr',
    setup (api) {
      api.modifyBundlerChain({
        order: 'post',
        handler: (chain, { CHAIN_ID, environment }) => {
          if (environment.name !== 'server') { return }
          chain.module.rule(CHAIN_ID.RULE.VUE).use(CHAIN_ID.USE.VUE).tap(options => ({
            ...options as Record<string, unknown>,
            // record rendered components on the server, so their chunks can be preloaded (see `plugins/preload.server`)
            exposeModuleIdentifier: (_request: string, { resourcePath }: { resourcePath: string }) => getRelativeModuleId(resourcePath, nuxt.options.srcDir),
          }))
        },
      })

      const serverDist = resolve(nuxt.options.buildDir, 'dist/server')
      let precomputedCode = 'export default undefined'
      let manifestCode: string | undefined

      setBuildOutput('clientManifest', () => manifestCode || 'export default {}', nuxt)
      setBuildOutput('clientPrecomputed', () => precomputedCode, nuxt)

      api.onAfterEnvironmentCompile(async ({ environment, stats }) => {
        if (environment.name !== 'client' || !stats) { return }

        const manifest = normalizeWebpackManifest(createWebpackManifest(stats, nuxt.options.srcDir) as any)
        await nuxt.callHook('build:manifest', manifest)
        precomputedCode = 'export default ' + serialize(precomputeDependencies(manifest))
        manifestCode = 'export default ' + serialize(manifest)

        if (!nuxt.options.dev && nuxt.options.experimental.buildCache) {
          await mkdir(serverDist, { recursive: true })
          await writeFile(join(serverDist, 'client.manifest.mjs'), manifestCode, 'utf8')
          await writeFile(join(serverDist, 'client.precomputed.mjs'), precomputedCode, 'utf8')
        }
      })
    },
  }
}

function getRelativeModuleId (resourcePath: string, context: string) {
  return normalize(relative(context, resourcePath)).replace(/^\.\//, '').replace(/\\/g, '/')
}

function getModuleId (identifier: string, context: string): string {
  const id = identifier.replace(/\s\w+$/, '') // remove appended hash
  // Module identifier format: /path/loaders!resource?query
  // (the match is anchored to the start of a segment, as identifiers include a long chain of loaders)
  const resourceMatch = id.match(/(?:^|!)([^!]*\.vue)(?:\?|$)/)
  // Extract relative resource path
  return resourceMatch && resourceMatch[1]
    ? getRelativeModuleId(resourceMatch[1], context)
    : id
}

function createWebpackManifest (rspackStats: Rspack.Stats, context: string) {
  const stats = rspackStats.toJson({
    modules: true,
    assets: true,
    chunks: true,
    chunkGroups: true,
    entrypoints: true,
  })

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
    if (!chunk || !chunk.files || !cid) {
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

    // Find all asset modules associated with the same chunk
    for (const module of assetModules) {
      if (module.chunks?.includes(cid)) {
        files.push(...module.assets!.map(fileToIndex))
      }
    }
  }

  return webpackManifest
}
