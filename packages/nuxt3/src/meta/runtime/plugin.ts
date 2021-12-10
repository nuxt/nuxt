import { getCurrentInstance } from 'vue'
import * as Components from './components'
import { useMeta } from './composables'
import { defineNuxtPlugin } from '#app'
// @ts-ignore
import metaConfig from '#build/meta.config.mjs'

type MetaComponents = typeof Components
declare module 'vue' {
  export interface GlobalComponents extends MetaComponents {}
}

export default defineNuxtPlugin((nuxtApp) => {
  useMeta(metaConfig.globalMeta)

  nuxtApp.vueApp.mixin({
    [metaConfig.mixinKey] () {
      const instance = getCurrentInstance()
      const options = instance?.type || /* nuxt2 */ instance?.proxy?.$options
      if (!options || !('head' in options)) { return }

      useMeta(options.head)
    }
  })

  for (const name in Components) {
    // eslint-disable-next-line import/namespace
    nuxtApp.vueApp.component(name, Components[name])
  }
})
