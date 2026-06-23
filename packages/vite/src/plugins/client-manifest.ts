import { readFileSync } from 'node:fs'
import { mkdir, rm, writeFile } from 'node:fs/promises'

import { relative, resolve } from 'pathe'
import { withTrailingSlash, withoutLeadingSlash } from 'ufo'
import escapeRE from 'escape-string-regexp'
import { normalizeViteManifest, precomputeDependencies } from 'vue-bundle-renderer'
import { serialize } from 'seroval'
import type { Manifest as RendererManifest } from 'vue-bundle-renderer'
import type { Plugin, Manifest as ViteClientManifest } from 'vite'
import { useNitro } from '@nuxt/kit'
import type { Nuxt } from '@nuxt/schema'
import { resolveClientEntry } from '../utils/config.ts'

export function ClientManifestPlugin (nuxt: Nuxt): Plugin {
  let clientEntry: string
  let key: string
  let disableCssCodeSplit: boolean

  let precomputedCode = 'export default undefined'
  let manifestCode: string

  const vfs = {
    'client.precomputed.mjs': () => precomputedCode,
    'client.manifest.mjs': () => manifestCode,
  }

  const nitro = useNitro()
  nitro.options.virtual ||= {}
  nitro.options._config.virtual ||= {}

  for (const key in vfs) {
    const filename = `#build/dist/server/${key}`
    nitro.options.virtual[filename] ||= vfs[key as keyof typeof vfs] as () => string
    nitro.options._config.virtual[filename] ||= vfs[key as keyof typeof vfs] as () => string
  }

  return {
    name: 'nuxt:client-manifest',
    // needs to run after server build (or after client build if there is no server build)
    applyToEnvironment: environment => environment.name === 'ssr',
    configResolved (config) {
      clientEntry = resolveClientEntry(config)
      key = relative(config.root, clientEntry)
      disableCssCodeSplit = config.build?.cssCodeSplit === false
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

      // expose client manifest for use in vue-bundle-renderer
      const clientDist = resolve(nuxt.options.buildDir, 'dist/client')

      const manifestFile = resolve(clientDist, 'manifest.json')
      const clientManifest = nuxt.options.dev ? devClientManifest : JSON.parse(readFileSync(manifestFile, 'utf-8')) as ViteClientManifest
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

        await rm(manifestFile, { force: true })
      }
    },
  }
}
