import { readFileSync } from 'node:fs'
import { mkdir, rm, writeFile } from 'node:fs/promises'

import { relative, resolve } from 'pathe'
import { withTrailingSlash, withoutLeadingSlash } from 'ufo'
import escapeRE from 'escape-string-regexp'
import { normalizeViteManifest, precomputeDependencies } from 'vue-bundle-renderer'
import { serialize } from 'seroval'
import type { Manifest as RendererManifest } from 'vue-bundle-renderer'
import type { Plugin, Manifest as ViteClientManifest } from 'vite'
import type { Nuxt } from '@nuxt/schema'
import { resolveClientEntry } from '../utils/config.ts'

export function ClientManifestPlugin (nuxt: Nuxt): Plugin {
  let clientEntry: string
  let key: string
  let disableCssCodeSplit: boolean

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

      // Write client manifest for use in vue-bundle-renderer
      const clientDist = resolve(nuxt.options.buildDir, 'dist/client')
      const serverDist = resolve(nuxt.options.buildDir, 'dist/server')

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

      await mkdir(serverDist, { recursive: true })

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
      const precomputed = precomputeDependencies(manifest)
      await writeFile(resolve(serverDist, 'client.manifest.mjs'), 'export default ' + serialize(manifest), 'utf8')
      await writeFile(resolve(serverDist, 'client.precomputed.mjs'), 'export default ' + serialize(precomputed), 'utf8')

      if (!nuxt.options.dev) {
        await rm(manifestFile, { force: true })
      }
    },
  }
}
