import { defineNuxtPlugin } from '#app/nuxt'

export default defineNuxtPlugin((nuxtApp) => {
  nuxtApp.vueApp.mixin({
    beforeCreate () {
      const { _registeredComponents } = this.$nuxt.ssrContext
      const { __moduleIdentifier } = this.$options
      _registeredComponents.add(__moduleIdentifier)
    }
  })
})
