import { defineNuxtPlugin } from '../nuxt'

export default defineNuxtPlugin({
  name: 'nuxt:webpack-preload',
  setup (nuxtApp) {
    nuxtApp.vueApp.mixin({
      beforeCreate () {
        const { modules } = this.$nuxt.ssrContext
        const { __moduleIdentifier } = this.$options
        modules.add(__moduleIdentifier)
      },
    })
  },
})
