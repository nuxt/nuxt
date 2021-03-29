import type { App } from 'vue'
import type { Plugin } from '@nuxt/app'

export type LegacyApp = App<Element> & {
  $root: LegacyApp
}

// TODO: plugins second argument (inject)
// TODO: payload.serverRrendered

export default <Plugin> function legacy ({ app }) {
  app.$nuxt.context = {}

  if (process.client) {
    const legacyApp = { ...app } as LegacyApp
    legacyApp.$root = legacyApp
    window[app.$nuxt.globalName] = legacyApp
  }

  if (process.server) {
    const { ssrContext } = app.$nuxt
    app.$nuxt.context.req = ssrContext.req
    app.$nuxt.context.res = ssrContext.res
  }
}
