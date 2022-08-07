import fse from 'fs-extra'
import { resolve } from 'pathe'
import { withoutLeadingSlash, withTrailingSlash } from 'ufo'
import escapeRE from 'escape-string-regexp'
import { normalizeViteManifest, Manifest } from 'vue-bundle-renderer'
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

  const clientManifest = ctx.nuxt.options.dev
    ? devClientManifest
    : await fse.readJSON(resolve(clientDist, 'manifest.json'))

  const buildAssetsDir = withTrailingSlash(withoutLeadingSlash(ctx.nuxt.options.app.buildAssetsDir))
  const BASE_RE = new RegExp(`^${escapeRE(buildAssetsDir)}`)

  for (const key in clientManifest) {
    if (clientManifest[key].file) {
      clientManifest[key].file = clientManifest[key].file.replace(BASE_RE, '')
    }
    for (const item of ['css', 'assets']) {
      if (clientManifest[key][item]) {
        clientManifest[key][item] = clientManifest[key][item].map(i => i.replace(BASE_RE, ''))
      }
    }
  }

  await fse.mkdirp(serverDist)
  const manifest = normalizeViteManifest(clientManifest)
  await fse.writeFile(resolve(serverDist, 'client.manifest.json'), JSON.stringify(manifest, null, 2), 'utf8')
  await fse.writeFile(resolve(serverDist, 'client.manifest.mjs'), 'export default ' + JSON.stringify(manifest, null, 2), 'utf8')
}
