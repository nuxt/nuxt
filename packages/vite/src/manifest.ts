import fse from 'fs-extra'
import { resolve } from 'pathe'
import type { ViteBuildContext } from './vite'

export async function writeManifest (ctx: ViteBuildContext, extraEntries: string[] = []) {
  // Write client manifest for use in vue-bundle-renderer
  const clientDist = resolve(ctx.nuxt.options.buildDir, 'dist/client')
  const serverDist = resolve(ctx.nuxt.options.buildDir, 'dist/server')

  const entries = [
    '@vite/client',
    'entry.mjs',
    ...extraEntries
  ]

  // Legacy dev manifest
  const devClientManifest = {
    publicPath: ctx.nuxt.options.build.publicPath,
    all: entries,
    initial: entries,
    async: [],
    modules: {}
  }

  const clientManifest = ctx.nuxt.options.dev
    ? devClientManifest
    : await fse.readJSON(resolve(clientDist, 'manifest.json'))

  await fse.mkdirp(serverDist)
  await fse.writeFile(resolve(serverDist, 'client.manifest.json'), JSON.stringify(clientManifest, null, 2), 'utf8')
  await fse.writeFile(resolve(serverDist, 'client.manifest.mjs'), 'export default ' + JSON.stringify(clientManifest, null, 2), 'utf8')
}
