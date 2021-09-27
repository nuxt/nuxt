import { resolve } from 'pathe'
import { addPlugin, addTemplate, defineNuxtModule } from '@nuxt/kit'
import { distDir } from '../dirs'
import type { MetaObject } from './types'

export default defineNuxtModule({
  name: 'meta',
  defaults: {
    charset: 'utf-8',
    viewport: 'width=device-width, initial-scale=1'
  },
  setup (options, nuxt) {
    const runtimeDir = resolve(distDir, 'meta/runtime')

    // Transpile @nuxt/meta and @vueuse/head
    nuxt.options.build.transpile.push(runtimeDir, '@vueuse/head')

    // Add #meta alias
    nuxt.options.alias['#meta'] = runtimeDir

    // Global meta
    const globalMeta: MetaObject = {
      meta: [
        { charset: options.charset },
        { name: 'viewport', content: options.viewport }
      ]
    }

    // Add global meta configuration
    addTemplate({
      filename: 'meta.config.mjs',
      getContents: () => 'export default ' + JSON.stringify({ globalMeta })
    })

    // Add generic plugin
    addPlugin({ src: resolve(runtimeDir, 'plugin') })

    // Add library specific plugin
    addPlugin({ src: resolve(runtimeDir, 'lib/vueuse-head.plugin') })
  }
})
