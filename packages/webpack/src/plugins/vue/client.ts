import type { Nuxt } from '@nuxt/schema'
import type { Compilation, Compiler } from 'webpack'

import { clientManifestStatsOptions, createClientManifestEmitter } from './manifest.ts'

interface PluginOptions {
  nuxt: Nuxt
}

export default class VueSSRClientPlugin {
  emitManifest: ReturnType<typeof createClientManifestEmitter>

  constructor (options: PluginOptions) {
    this.emitManifest = createClientManifestEmitter(options.nuxt)
  }

  apply (compiler: Compiler) {
    compiler.hooks.afterEmit.tap('VueSSRClientPlugin', async (compilation: Compilation) => {
      await this.emitManifest(compilation.getStats().toJson(clientManifestStatsOptions))
    })
  }
}
