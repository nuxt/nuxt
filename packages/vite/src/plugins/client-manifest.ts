import { readFileSync } from 'node:fs'
import { mkdir, rm, writeFile } from 'node:fs/promises'

import { relative, resolve } from 'pathe'
import { withTrailingSlash, withoutLeadingSlash } from 'ufo'
import escapeRE from 'escape-string-regexp'
import { normalizeViteManifest, precomputeDependencies } from 'vue-bundle-renderer'
import { serialize } from 'seroval'
import type { Manifest as RendererManifest } from 'vue-bundle-renderer'
import type { Plugin, Manifest as ViteClientManifest } from 'vite'
import { setBuildOutput } from '@nuxt/kit'
import type { Nuxt } from '@nuxt/schema'
import { resolveClientEntry } from '../utils/config.ts'
import { collectGlobalCss } from '../utils/css.ts'

export function ClientManifestPlugin (nuxt: Nuxt): Plugin {
  let clientEntry: string
  let key: string
  let disableCssCodeSplit: boolean

  let precomputedCode = 'export default undefined'
  // Default empty manifest so the build output is loadable before the real one is populated.
  let manifestCode = 'export default {}'

  // captured in-memory from the client env's bundle under env-API
  let rawClientManifest: ViteClientManifest | undefined

  const envApi = nuxt.options.experimental.nitroViteEnvironment

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
    const entryFile = envApi ? `/@fs${clientEntry}` : clientEntry
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
    // first `nuxt/manifest`/`nuxt/precomputed` provider read for env-API, by
    // which point the client build has flushed `manifest.json` to disk.
    applyToEnvironment: environment => environment.name === 'ssr' || (envApi && environment.name === 'client'),
    generateBundle: {
      order: 'post',
      handler (_options, bundle) {
        if (!envApi || nuxt.options.dev || this.environment?.name !== 'client') { return }
        const asset = bundle['manifest.json']
        if (asset?.type === 'asset') {
          rawClientManifest = JSON.parse(asset.source.toString()) as ViteClientManifest
        }
      },
    },
    configResolved (config) {
      clientEntry = resolveClientEntry(config)
      key = relative(config.root, clientEntry)
      disableCssCodeSplit = config.build?.cssCodeSplit === false
    },
    async closeBundle () {
      // In env-API mode finalisation is triggered lazily by the provider
      // (see `finalize`), since the ssr env reads the manifest before
      // `closeBundle` runs.
      if (envApi && !nuxt.options.dev) { return }
      await finalize()
    },
  }

  async function finalizeBuildManifest (): Promise<void> {
    // This is only used for ssr: false - when ssr is enabled we use vite-node runtime manifest
    const devClientManifest = buildDevClientManifest()

    // Legacy reads the client `manifest.json` from disk, written by the time
    // the ssr env's `closeBundle` runs. Env-API uses the in-memory capture
    // (`rawClientManifest`).
    const manifestFile = resolve(nuxt.options.buildDir, 'dist/client', 'manifest.json')
    const clientManifest = nuxt.options.dev
      ? devClientManifest
      : envApi
        ? (rawClientManifest ?? {})
        : JSON.parse(readFileSync(manifestFile, 'utf-8')) as ViteClientManifest
    const manifestEntries = Object.values(clientManifest)

    const buildAssetsDir = withTrailingSlash(withoutLeadingSlash(nuxt.options.app.buildAssetsDir))
    const BASE_RE = new RegExp(`^${escapeRE(buildAssetsDir)}`)

    for (const entry of manifestEntries) {
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
      if (nuxt.options.experimental.buildCache) {
        const serverDist = resolve(nuxt.options.buildDir, 'dist/server')
        await mkdir(serverDist, { recursive: true })
        await writeFile(resolve(serverDist, 'client.manifest.mjs'), manifestCode, 'utf8')
        await writeFile(resolve(serverDist, 'client.precomputed.mjs'), precomputedCode, 'utf8')
      }

      // The legacy build reads `manifest.json` from disk, so we can remove it once consumed.
      if (!envApi) {
        await rm(manifestFile, { force: true })
      }
    }
  }
}
