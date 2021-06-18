import { defineNuxtPlugin } from '@nuxt/app'

export default defineNuxtPlugin(({ app }) => {
  app.mixin({
    beforeCreate () {
      const { _registeredComponents } = this.$nuxt.ssrContext
      const { __moduleIdentifier } = this.$options
      _registeredComponents.add(__moduleIdentifier)
    }
  })
})
