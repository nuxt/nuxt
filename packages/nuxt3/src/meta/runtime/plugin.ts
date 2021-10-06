import { getCurrentInstance } from 'vue'
import * as Components from './components'
import { useMeta } from './composables'
import { defineNuxtPlugin } from '#app'
// @ts-ignore
import metaConfig from '#build/meta.config.mjs'

export default defineNuxtPlugin((nuxt) => {
  useMeta(metaConfig.globalMeta)

  nuxt.app.mixin({
    [metaConfig.mixinKey] () {
      const instance = getCurrentInstance()
      const options = instance?.type || /* nuxt2 */ instance?.proxy?.$options
      if (!options || !('head' in options)) { return }

      useMeta(options.head)
    }
  })

  for (const name in Components) {
    // eslint-disable-next-line import/namespace
    nuxt.app.component(name, Components[name])
  }
})
