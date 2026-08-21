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
import { bundlerDiagnostics } from '@nuxt/kit/internal'
import type { Nuxt } from '@nuxt/schema'
import { resolveClientEntry, resolveClientManifestFile } from '../utils/config.ts'

export function ClientManifestPlugin (nuxt: Nuxt): Plugin {
  let clientEntry: string
  let key: string
  let disableCssCodeSplit: boolean
  let manifestFile: string
  // `closeBundle` can run more than once for the ssr environment, and its last step
  // removes `manifestFile`. Keep the last source read as a fallback so a later pass in
  // the same build does not read an ENOENT.
  let manifestSource: string | undefined

  let precomputedCode = 'export default undefined'
  // Default empty manifest so the build output is loadable before the real one is populated.
  let manifestCode = 'export default {}'

  setBuildOutput('clientPrecomputed', () => precomputedCode)
  setBuildOutput('clientManifest', () => manifestCode)

  return {
    name: 'nuxt:client-manifest',
    // needs to run after server build (or after client build if there is no server build)
    applyToEnvironment: environment => environment.name === 'ssr',
    configResolved (config) {
      clientEntry = resolveClientEntry(config)
      key = relative(config.root, clientEntry)
      disableCssCodeSplit = config.build?.cssCodeSplit === false
      if (!nuxt.options.dev) {
        const clientBuild = config.environments.client?.build ?? config.build
        manifestFile = resolve(clientBuild.outDir, resolveClientManifestFile(clientBuild.manifest))
      }
    },
    async closeBundle () {
      // This is only used for ssr: false - when ssr is enabled we use vite-node runtime manifest
      const devClientManifest: RendererManifest = {
        '@vite/client': {
          isEntry: true,
          file: '@vite/client',
          css: [],
          module: true,
          resourceType: 'script',
        },
        ...nuxt.options.features.noScripts === 'all'
          ? {}
          : {
              [clientEntry]: {
                isEntry: true,
                file: clientEntry,
                module: true,
                resourceType: 'script',
              },
            },
      }

      const clientManifest = nuxt.options.dev ? devClientManifest : JSON.parse(readManifestFromDisk()) as ViteClientManifest
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
        await rm(manifestFile, { force: true })
      }
    },
  }

  function readManifestFromDisk (): string {
    try {
      // Read through to the file on every pass and refresh the fallback: Vite reuses this
      // plugin across rebuilds, so a later client build writes a new manifest that must
      // win over anything cached from an earlier one.
      manifestSource = readFileSync(manifestFile, 'utf-8')
      return manifestSource
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        // An earlier pass in this build already consumed and removed `manifestFile`, so
        // reuse the source it read. This caches the raw source rather than the parsed
        // manifest because callers mutate the object they get back (and `build:manifest`
        // hooks mutate it further), so each pass must still parse its own copy.
        if (manifestSource !== undefined) {
          return manifestSource
        }
        throw bundlerDiagnostics.NUXT_B7021({ manifestFile })
      }
      throw error
    }
  }
}
