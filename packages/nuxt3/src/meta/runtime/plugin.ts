import { computed, getCurrentInstance } from 'vue'
import * as Components from './components'
import { useMeta } from './composables'
import { defineNuxtPlugin, useNuxtApp } from '#app'
// @ts-ignore
import metaConfig from '#build/meta.config.mjs'

type MetaComponents = typeof Components
declare module 'vue' {
  export interface GlobalComponents extends MetaComponents {}
}

const metaMixin = {
  [metaConfig.mixinKey] () {
    const instance = getCurrentInstance()
    const options = instance?.type || /* nuxt2 */ instance?.proxy?.$options
    const nuxtApp = useNuxtApp()
    if (!options || !('head' in options)) { return }

    const source = typeof options.head === 'function'
      ? computed(() => options.head(nuxtApp))
      : options.head

    useMeta(source)
  }
}

export default defineNuxtPlugin((nuxtApp) => {
  useMeta(metaConfig.globalMeta)

  nuxtApp.vueApp.mixin(metaMixin)

  for (const name in Components) {
    // eslint-disable-next-line import/namespace
    nuxtApp.vueApp.component(name, Components[name])
  }
})
