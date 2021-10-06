import { resolve } from 'pathe'
import { addPlugin, addTemplate, defineNuxtModule, isNuxt3 } from '@nuxt/kit'
import defu from 'defu'
import { distDir } from '../dirs'
import type { MetaObject } from './runtime'

export default defineNuxtModule({
  name: 'meta',
  defaults: {
    charset: 'utf-8',
    viewport: 'width=device-width, initial-scale=1'
  },
  setup (options, nuxt) {
    const runtimeDir = nuxt.options.alias['#meta'] || resolve(distDir, 'meta/runtime')

    // Transpile @nuxt/meta and @vueuse/head
    nuxt.options.build.transpile.push(runtimeDir, '@vueuse/head')

    // Add #meta alias
    nuxt.options.alias['#meta'] = runtimeDir

    // Global meta
    const globalMeta: MetaObject = defu(nuxt.options.meta, {
      meta: [
        { charset: options.charset },
        { name: 'viewport', content: options.viewport }
      ]
    })

    // Add global meta configuration
    addTemplate({
      filename: 'meta.config.mjs',
      getContents: () => 'export default ' + JSON.stringify({ globalMeta, mixinKey: isNuxt3() ? 'created' : 'setup' })
    })

    // Add generic plugin
    addPlugin({ src: resolve(runtimeDir, 'plugin') })

    // Add library specific plugin
    addPlugin({ src: resolve(runtimeDir, 'lib/vueuse-head.plugin') })
  }
})
