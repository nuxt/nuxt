import { resolve } from 'upath'
import { addPlugin, addTemplate, defineNuxtModule } from '@nuxt/kit'
import type { MetaObject } from '@nuxt/meta'

export default defineNuxtModule({
  name: 'meta',
  defaults: {
    charset: 'utf-8',
    viewport: 'width=device-width, initial-scale=1'
  },
  setup (options, nuxt) {
    const runtimeDir = resolve(__dirname, 'runtime')

    // Transpile @nuxt/meta
    nuxt.options.build.transpile.push('@nuxt/meta', runtimeDir, '@vueuse/head')
    nuxt.options.alias['@nuxt/meta'] = resolve(runtimeDir, 'index')

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
