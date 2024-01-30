import { defineNuxtPlugin } from '../nuxt'

export default defineNuxtPlugin({
  name: 'nuxt:webpack-preload',
  setup (nuxtApp) {
    nuxtApp.vueApp.mixin({
      beforeCreate () {
        const { _registeredComponents } = this.$nuxt.ssrContext
        const { __moduleIdentifier } = this.$options
        _registeredComponents.add(__moduleIdentifier)
      }
    })
  }
})
