export default function legacy ({ app }) {
  app.$nuxt.context = {}

  if (process.client) {
    const legacyApp = { ...app }
    legacyApp.$root = legacyApp
    window[app.$nuxt.globalName] = legacyApp
  }

  if (process.server) {
    const { ssrContext } = app.$nuxt
    app.$nuxt.context.req = ssrContext.req
    app.$nuxt.context.res = ssrContext.res
  }
}
