import { resolve } from 'upath'
import { defineNuxtModule } from '@nuxt/kit'

export default defineNuxtModule({
  name: 'meta',
  setup (_options, nuxt) {
    const runtimeDir = resolve(__dirname, 'runtime')

    nuxt.options.build.transpile.push('@nuxt/meta', runtimeDir)
    nuxt.options.alias['@nuxt/meta'] = resolve(runtimeDir, 'index')

    nuxt.hook('app:resolve', (app) => {
      app.plugins.push({ src: resolve(runtimeDir, 'vueuse-head') })
      app.plugins.push({ src: resolve(runtimeDir, 'meta') })
    })
  }
})
