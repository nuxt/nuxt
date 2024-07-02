import { readFileSync } from 'node:fs'
import { mkdir, rm, writeFile } from 'node:fs/promises'

import { relative, resolve } from 'pathe'
import { withTrailingSlash, withoutLeadingSlash } from 'ufo'
import escapeRE from 'escape-string-regexp'
import { normalizeViteManifest } from 'vue-bundle-renderer'
import type { ViteBuildContext } from './vite'

export async function writeManifest (ctx: ViteBuildContext) {
  // Write client manifest for use in vue-bundle-renderer
  const clientDist = resolve(ctx.nuxt.options.buildDir, 'dist/client')
  const serverDist = resolve(ctx.nuxt.options.buildDir, 'dist/server')

  const manifestFile = resolve(clientDist, 'manifest.json')
  const clientManifest = JSON.parse(readFileSync(manifestFile, 'utf-8'))

  const buildAssetsDir = withTrailingSlash(withoutLeadingSlash(ctx.nuxt.options.app.buildAssetsDir))
  const BASE_RE = new RegExp(`^${escapeRE(buildAssetsDir)}`)

  for (const key in clientManifest) {
    const entry = clientManifest[key]
    if (entry.file) {
      entry.file = entry.file.replace(BASE_RE, '')
    }
    for (const item of ['css', 'assets']) {
      if (entry[item]) {
        entry[item] = entry[item].map((i: string) => i.replace(BASE_RE, ''))
      }
    }
  }

  await mkdir(serverDist, { recursive: true })

  if (ctx.config.build?.cssCodeSplit === false) {
    for (const key in clientManifest as Record<string, { file?: string }>) {
      const val = clientManifest[key]
      if (val.file?.endsWith('.css')) {
        const key = relative(ctx.config.root!, ctx.entry)
        clientManifest[key].css ||= []
        clientManifest[key].css!.push(val.file)
        break
      }
    }
  }

  const manifest = normalizeViteManifest(clientManifest)
  await ctx.nuxt.callHook('build:manifest', manifest)
  const stringifiedManifest = JSON.stringify(manifest, null, 2)
  await writeFile(resolve(serverDist, 'client.manifest.json'), stringifiedManifest, 'utf8')
  await writeFile(resolve(serverDist, 'client.manifest.mjs'), 'export default ' + stringifiedManifest, 'utf8')

  if (!ctx.nuxt.options.dev) {
    await rm(manifestFile, { force: true })
  }
}
