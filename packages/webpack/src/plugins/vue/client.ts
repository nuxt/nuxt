import type { Nuxt } from '@nuxt/schema'
import type { Compilation, Compiler } from 'webpack'

import { clientManifestStatsOptions, createClientManifestEmitter } from './manifest.ts'

export default class VueSSRClientPlugin {
  emitManifest: ReturnType<typeof createClientManifestEmitter>

  constructor (nuxt: Nuxt) {
    this.emitManifest = createClientManifestEmitter(nuxt)
  }

  apply (compiler: Compiler) {
    compiler.hooks.afterEmit.tap('VueSSRClientPlugin', async (compilation: Compilation) => {
      await this.emitManifest(compilation.getStats().toJson(clientManifestStatsOptions))
    })
  }
}
