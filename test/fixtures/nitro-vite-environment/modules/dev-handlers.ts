import { joinURL } from 'ufo'
import { addDevServerHandler, defineNuxtModule } from 'nuxt/kit'

export default defineNuxtModule(
  function (_, nuxt) {
    for (const prefix of ['/_dev-handler/', nuxt.options.app.buildAssetsDir]) {
      addDevServerHandler({
        route: joinURL(prefix, 'dev-handler/**'),
        handler: { nuxt: event => `dev-handler:${event.url.pathname}` },
      })
    }
  },
)
