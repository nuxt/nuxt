import type { Plugin } from 'nuxt/vue-app/types'

const preload: Plugin = function ({ app }) {
  app.mixin({
    beforeCreate() {
      const { _registeredComponents } = this.$nuxt.ssrContext
      const { __moduleIdentifier } = this.$options
      _registeredComponents.push(__moduleIdentifier)
    }
  })
}

export default preload