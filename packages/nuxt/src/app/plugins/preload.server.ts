import { defineNuxtPlugin } from '../nuxt'
import type { ObjectPlugin, Plugin } from '../nuxt'

const plugin: Plugin & ObjectPlugin = defineNuxtPlugin({
  name: 'nuxt:webpack-preload',
  setup (nuxtApp) {
    nuxtApp.vueApp.mixin({
      beforeCreate () {
        const { modules } = this.$nuxt.ssrContext
        const { __moduleIdentifier } = this.$options
        if (__moduleIdentifier) {
          modules.add(__moduleIdentifier)
        }
      },
    })
  },
})

export default plugin
