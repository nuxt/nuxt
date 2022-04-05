import { resolve } from 'pathe'
import { addPlugin, addTemplate, defineNuxtModule, isNuxt3 } from '@nuxt/kit'
import defu from 'defu'
import { distDir } from '../dirs'
import type { MetaObject } from './runtime'

export default defineNuxtModule({
  meta: {
    name: 'meta'
  },
  defaults: {
    charset: 'utf-8',
    viewport: 'width=device-width, initial-scale=1'
  },
  setup (options, nuxt) {
    const runtimeDir = nuxt.options.alias['#head'] || resolve(distDir, 'head/runtime')

    // Transpile @nuxt/meta and @vueuse/head
    nuxt.options.build.transpile.push('@vueuse/head')

    // Add #head alias
    nuxt.options.alias['#head'] = runtimeDir

    // Global meta
    const globalMeta: MetaObject = defu(nuxt.options.app.head, {
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
