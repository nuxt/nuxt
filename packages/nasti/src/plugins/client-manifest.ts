import { existsSync, readFileSync } from 'node:fs'
import { mkdir, rm, writeFile } from 'node:fs/promises'

import { relative, resolve } from 'pathe'
import { withTrailingSlash, withoutLeadingSlash } from 'ufo'
import escapeRE from 'escape-string-regexp'
import { normalizeViteManifest, precomputeDependencies } from 'vue-bundle-renderer'
import { serialize } from 'seroval'
import type { Manifest as RendererManifest } from 'vue-bundle-renderer'
import { logger, useNitro } from '@nuxt/kit'
import type { Nuxt } from '@nuxt/schema'
import type { NastiPlugin, ResolvedConfig } from '@nasti-toolchain/nasti'

/**
 * Builds the client manifest Nitro uses to render `<script>` / `<link>` tags, and exposes
 * it (plus its precomputed dependency graph) to Nitro as virtual modules.
 *
 * Mirrors `@nuxt/vite-builder`'s `ClientManifestPlugin`, with two Nasti-specific changes:
 *  - the dev HMR client lives at `/@nasti/client` (Vite's is `@vite/client`);
 *  - Nasti does not emit a Vite-style `dist/client/manifest.json`, so the production path
 *    reads one only if present and otherwise falls back to the synthetic manifest with a
 *    warning (full production preloading needs a manifest from Nasti — a known gap).
 *
 * Applied to the `ssr` environment only, so it runs after the server build (or after the
 * client build when there is no server build).
 */
export function NastiClientManifestPlugin (nuxt: Nuxt, clientEntry: string): NastiPlugin {
  let key: string
  let disableCssCodeSplit = false

  let precomputedCode = 'export default undefined'
  let manifestCode = 'export default undefined'

  const vfs = {
    'client.precomputed.mjs': () => precomputedCode,
    'client.manifest.mjs': () => manifestCode,
  }

  // Register the virtual modules eagerly with lazy getters, so Nitro can resolve the paths
  // immediately while the actual content is only computed once the build has completed.
  const nitro = useNitro()
  nitro.options.virtual ||= {}
  nitro.options._config.virtual ||= {}
  for (const name in vfs) {
    const filename = `#build/dist/server/${name}`
    nitro.options.virtual[filename] ||= vfs[name as keyof typeof vfs]
    nitro.options._config.virtual[filename] ||= vfs[name as keyof typeof vfs]
  }

  return {
    name: 'nuxt:nasti:client-manifest',
    // Run after the server build (or the client build if there is no server build).
    applyToEnvironment: environment => environment.name === 'ssr',
    configResolved (config: ResolvedConfig) {
      key = relative(config.root, clientEntry)
      disableCssCodeSplit = config.build.cssCodeSplit === false
    },
    async closeBundle () {
      // Synthetic manifest used in dev and for `ssr: false` (no real per-chunk manifest is
      // needed — the dev runtime resolves modules directly).
      const devClientManifest: RendererManifest = {
        '@nasti/client': {
          isEntry: true,
          file: '@nasti/client',
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

      const clientDist = resolve(nuxt.options.buildDir, 'dist/client')
      const manifestFile = resolve(clientDist, 'manifest.json')

      let clientManifest: RendererManifest
      if (nuxt.options.dev) {
        clientManifest = devClientManifest
      } else if (existsSync(manifestFile)) {
        clientManifest = JSON.parse(readFileSync(manifestFile, 'utf-8')) as RendererManifest
      } else {
        // Nasti does not (yet) emit a Vite-style manifest.json. Don't crash the build —
        // fall back to the synthetic manifest and surface the limitation.
        logger.warn('[nasti-builder] Nasti did not emit a client `manifest.json`; using a minimal synthetic manifest. Production `<link>`/`<script>` asset preloading will be incomplete.')
        clientManifest = devClientManifest
      }

      const manifestEntries = Object.values(clientManifest)

      const buildAssetsDir = withTrailingSlash(withoutLeadingSlash(nuxt.options.app.buildAssetsDir))
      const BASE_RE = new RegExp(`^${escapeRE(buildAssetsDir)}`)

      for (const entry of manifestEntries) {
        entry.file &&= entry.file.replace(BASE_RE, '')
        for (const item of ['css', 'assets'] as const) {
          entry[item] &&= entry[item]!.map((i: string) => i.replace(BASE_RE, ''))
        }
      }

      // When CSS code-splitting is disabled, fold the single emitted CSS file into the
      // entry so it is still linked.
      if (disableCssCodeSplit && clientManifest[key]) {
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
        await rm(manifestFile, { force: true })
      }
    },
  }
}
