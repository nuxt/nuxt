import type { App } from 'vue'
import type { Plugin } from 'nuxt/vue-app/types'

const legacy: Plugin = function ({ app }) {
  app.$nuxt.context = {}

  if (process.client) {
    const legacyApp: App<Element> & { $root?: App<Element> } = { ...app }
    legacyApp.$root = legacyApp
    window[app.$nuxt.globalName] = legacyApp
  }

  if (process.server) {
    const { ssrContext } = app.$nuxt
    app.$nuxt.context.req = ssrContext.req
    app.$nuxt.context.res = ssrContext.res
  }
}

export default legacy