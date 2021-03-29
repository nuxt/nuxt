import type { Plugin } from '@nuxt/app'

export default <Plugin> function preload ({ app }) {
  app.mixin({
    beforeCreate () {
      const { _registeredComponents } = this.$nuxt.ssrContext
      const { __moduleIdentifier } = this.$options
      _registeredComponents.add(__moduleIdentifier)
    }
  })
}
