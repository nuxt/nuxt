import fse from 'fs-extra'
import { relative, resolve } from 'pathe'
import { withTrailingSlash, withoutLeadingSlash } from 'ufo'
import escapeRE from 'escape-string-regexp'
import { normalizeViteManifest } from 'vue-bundle-renderer'
import type { Manifest } from 'vue-bundle-renderer'
import type { ViteBuildContext } from './vite'

export async function writeManifest (ctx: ViteBuildContext, css: string[] = []) {
  // Write client manifest for use in vue-bundle-renderer
  const clientDist = resolve(ctx.nuxt.options.buildDir, 'dist/client')
  const serverDist = resolve(ctx.nuxt.options.buildDir, 'dist/server')

  const devClientManifest: Manifest = {
    '@vite/client': {
      isEntry: true,
      file: '@vite/client',
      css,
      module: true,
      resourceType: 'script'
    },
    [ctx.entry]: {
      isEntry: true,
      file: ctx.entry,
      module: true,
      resourceType: 'script'
    }
  }

  const manifestFile = resolve(clientDist, 'manifest.json')
  const clientManifest = ctx.nuxt.options.dev
    ? devClientManifest
    : await fse.readJSON(manifestFile)

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

  await fse.mkdirp(serverDist)

  if (ctx.config.build?.cssCodeSplit === false) {
    const entryCSS = Object.values(clientManifest as Record<string, { file?: string }>).find(val => (val).file?.endsWith('.css'))?.file
    if (entryCSS) {
      const key = relative(ctx.config.root!, ctx.entry)
      clientManifest[key].css ||= []
      clientManifest[key].css!.push(entryCSS)
    }
  }

  const manifest = normalizeViteManifest(clientManifest)
  await ctx.nuxt.callHook('build:manifest', manifest)
  const stringifiedManifest = JSON.stringify(manifest, null, 2)
  await fse.writeFile(resolve(serverDist, 'client.manifest.json'), stringifiedManifest, 'utf8')
  await fse.writeFile(resolve(serverDist, 'client.manifest.mjs'), 'export default ' + stringifiedManifest, 'utf8')

  if (!ctx.nuxt.options.dev) {
    await fse.rm(manifestFile, { force: true })
  }
}
