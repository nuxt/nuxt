import { readFileSync } from 'node:fs'
import { rm } from 'node:fs/promises'

import { relative, resolve } from 'pathe'
import { withTrailingSlash, withoutLeadingSlash } from 'ufo'
import escapeRE from 'escape-string-regexp'
import { normalizeViteManifest, precomputeDependencies } from 'vue-bundle-renderer'
import { serialize } from 'seroval'
import type { Manifest as RendererManifest } from 'vue-bundle-renderer'
import type { Plugin, Manifest as ViteClientManifest } from 'vite'
import { setBuildOutput } from '@nuxt/kit'
import { bundlerDiagnostics, setServerBuild, useServerBuild } from '@nuxt/kit/internal'
import type { Nuxt } from '@nuxt/schema'
import { resolveClientEntry, resolveClientManifestFile } from '../utils/config.ts'
import { collectGlobalCss, toFsUrl } from '../utils/css.ts'

const QUERY_RE = /\?.+$/

export interface FacadelessChunkInfo {
  /** Chunk file name, as emitted in the bundle and as used in manifest `file` values. */
  file: string
  /** Source module ids bundled into the chunk, relative to the vite root (like other manifest keys). */
  modules: string[]
}

/**
 * Alias source modules bundled into chunks without a facade module to their
 * chunk's manifest entry, so the SSR renderer can resolve their stylesheets
 * (https://github.com/nuxt/nuxt/issues/36343).
 *
 * Must run before the `buildAssetsDir` prefix is stripped from `file` values
 * in `finalizeBuildManifest`, so chunk file names line up with manifest entries.
 */
export function aliasFacadelessChunkModules (clientManifest: ViteClientManifest, facadelessChunks: FacadelessChunkInfo[]): void {
  const manifestEntries = Object.values(clientManifest)
  for (const { file, modules } of facadelessChunks) {
    const chunkEntry = manifestEntries.find(entry => entry.file === file)
    // Without CSS there is nothing for the SSR renderer to resolve.
    if (!chunkEntry?.css?.length) { continue }
    const { css, assets, imports, dynamicImports } = chunkEntry
    for (const id of modules) {
      // Never overwrite an existing (more specific) manifest entry.
      if (id in clientManifest) { continue }
      clientManifest[id] = {
        file,
        css: [...css],
        ...(assets && { assets: [...assets] }),
        ...(imports && { imports: [...imports] }),
        ...(dynamicImports && { dynamicImports: [...dynamicImports] }),
      }
    }
  }
}

export function ClientManifestPlugin (nuxt: Nuxt): Plugin {
  let clientEntry: string
  let key: string
  let root: string
  let disableCssCodeSplit: boolean
  let manifestFileName: string
  let manifestFile: string

  let precomputedCode = 'export default undefined'
  // Default empty manifest so the build output is loadable before the real one is populated.
  let manifestCode = 'export default {}'

  // captured in-memory from the client env's bundle under env-API
  let rawClientManifest: ViteClientManifest | undefined

  // Source modules bundled into chunks without a facade module, grouped by
  // chunk file name. Vite only emits manifest entries for facade modules, so
  // without this the SSR renderer cannot resolve the stylesheets of these
  // modules (https://github.com/nuxt/nuxt/issues/36343).
  const facadelessChunkModules: FacadelessChunkInfo[] = []

  let clientBundleGenerated = false

  const envApi = !useServerBuild(nuxt).buildsSeparately

  let finalized: Promise<void> | undefined
  const finalize = () => (finalized ??= finalizeBuildManifest())

  setBuildOutput('clientPrecomputed', async () => {
    if (envApi && !nuxt.options.dev) { await finalize() }
    return precomputedCode
  })
  setBuildOutput('clientManifest', async () => {
    if (envApi && nuxt.options.dev) {
      return 'export default ' + serialize(normalizeViteManifest(buildDevClientManifest()))
    }
    if (envApi) { await finalize() }
    return manifestCode
  })

  // The dev manifest carries only the globally-registered CSS; per-request CSS
  // from the ssr graph is pushed to the ssr runner over the env hot channel and
  // patched into the renderer manifest at render time (see `patchDevClientCss`).
  const buildDevClientManifest = (): RendererManifest => {
    const entryFile = envApi ? toFsUrl(clientEntry) : clientEntry
    return {
      '@vite/client': {
        isEntry: true,
        file: '@vite/client',
        css: envApi ? collectGlobalCss(nuxt) : [],
        module: true,
        resourceType: 'script',
      },
      ...nuxt.options.features.noScripts === 'all'
        ? {}
        : {
            [clientEntry]: {
              isEntry: true,
              file: entryFile,
              module: true,
              resourceType: 'script',
            },
          },
    }
  }

  return {
    name: 'nuxt:client-manifest',
    // Finalised in the ssr env: its `closeBundle` for legacy, or lazily on the
    // first `nuxt/internal/manifest`/`nuxt/internal/precomputed` provider read for env-API, by
    // which point the client build has flushed `manifest.json` to disk.
    applyToEnvironment: environment => environment.name === 'ssr' || environment.name === 'client',
    generateBundle: {
      order: 'post',
      handler (_options, bundle) {
        if (nuxt.options.dev || this.environment?.name !== 'client') { return }
        clientBundleGenerated = true
        for (const chunk of Object.values(bundle)) {
          // Chunks without a facade module get no manifest entry of their own,
          // so record their source modules (keyed like other manifest entries)
          // to alias them to the chunk entry when finalising the manifest.
          if (chunk.type !== 'chunk' || chunk.facadeModuleId) { continue }
          facadelessChunkModules.push({
            file: chunk.fileName,
            modules: chunk.moduleIds
              .filter(id => !id.startsWith('\0'))
              .map(id => relative(root, id.replace(QUERY_RE, ''))),
          })
        }
        if (!envApi) { return }
        const asset = bundle[manifestFileName]
        if (asset?.type === 'asset') {
          rawClientManifest = JSON.parse(asset.source.toString()) as ViteClientManifest
        }
      },
    },
    configResolved (config) {
      clientEntry = resolveClientEntry(config)
      key = relative(config.root, clientEntry)
      root = config.root
      disableCssCodeSplit = config.build?.cssCodeSplit === false
      if (!nuxt.options.dev) {
        const clientBuild = config.environments.client?.build ?? config.build
        manifestFileName = resolveClientManifestFile(clientBuild.manifest)
        manifestFile = resolve(clientBuild.outDir, manifestFileName)
        setServerBuild({
          input: {
            clientDir: () => clientBuild.outDir,
            clientManifest: () => manifestFile,
          },
        }, nuxt)
      }
    },
    async closeBundle () {
      if (this.environment?.name !== 'ssr') { return }
      // In env-API mode finalisation is triggered lazily by the provider
      // (see `finalize`), since the ssr env reads the manifest before
      // `closeBundle` runs.
      if (envApi && !nuxt.options.dev) { return }
      await finalize()
    },
  }

  async function finalizeBuildManifest (): Promise<void> {
    if (!nuxt.options.dev && !clientBundleGenerated) {
      // The client build never produced a bundle (for example, a build aborted
      // before it ran), so there is no manifest to finalise.
      return
    }

    // This is only used for ssr: false - when ssr is enabled we use vite-node runtime manifest
    const devClientManifest = buildDevClientManifest()

    // Legacy reads the client manifest from disk, written by the time the ssr
    // env's `closeBundle` runs. Env-API uses the in-memory capture
    // (`rawClientManifest`).
    const clientManifest = nuxt.options.dev
      ? devClientManifest
      : envApi
        ? (rawClientManifest ?? raiseMissingManifest())
        : JSON.parse(readManifestFromDisk()) as ViteClientManifest
    const manifestEntries = Object.values(clientManifest)

    // Chunks without a facade module have no manifest entry keyed by their
    // source modules, so the SSR renderer cannot resolve the stylesheets of
    // the components bundled into them (https://github.com/nuxt/nuxt/issues/36343).
    // Alias each of their source modules to the chunk entry so their CSS is
    // linked in the SSR HTML like any other component's.
    aliasFacadelessChunkModules(clientManifest, facadelessChunkModules)

    const buildAssetsDir = withTrailingSlash(withoutLeadingSlash(nuxt.options.app.buildAssetsDir))
    const BASE_RE = new RegExp(`^${escapeRE(buildAssetsDir)}`)

    for (const entry of Object.values(clientManifest)) {
      entry.file &&= entry.file.replace(BASE_RE, '')
      for (const item of ['css', 'assets'] as const) {
        entry[item] &&= entry[item].map((i: string) => i.replace(BASE_RE, ''))
      }
    }

    if (disableCssCodeSplit) {
      for (const entry of manifestEntries) {
        if (entry.file?.endsWith('.css')) {
          clientManifest[key]!.css ||= []
          ;(clientManifest[key]!.css as string[]).push(entry.file)
          break
        }
      }
    }

    const manifest = normalizeViteManifest(clientManifest)
    await nuxt.callHook('build:manifest', manifest)

    precomputedCode = 'export default ' + serialize(precomputeDependencies(manifest))
    manifestCode = 'export default ' + serialize(manifest)

    if (!nuxt.options.dev) {
      // The legacy build reads the manifest from disk, so we can remove it once consumed.
      if (!envApi) {
        await rm(manifestFile, { force: true })
      }
    }
  }

  function readManifestFromDisk (): string {
    try {
      return readFileSync(manifestFile, 'utf-8')
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        raiseMissingManifest()
      }
      throw error
    }
  }

  function raiseMissingManifest (): never {
    throw bundlerDiagnostics.NUXT_B7021({ manifestFile })
  }
}
