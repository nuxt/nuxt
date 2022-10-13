import { getCurrentInstance } from 'vue'
import { useHead } from './composables'
import { defineNuxtPlugin, useNuxtApp } from '#app'

const metaMixin = {
  created () {
    const instance = getCurrentInstance()
    if (!instance) { return }

    const options = instance.type
    if (!options || !('head' in options)) { return }

    const nuxtApp = useNuxtApp()
    const source = typeof options.head === 'function'
      ? () => options.head(nuxtApp)
      : options.head

    useHead(source)
  }
}

export default defineNuxtPlugin((nuxtApp) => {
  nuxtApp.vueApp.mixin(metaMixin)
})
