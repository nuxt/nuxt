import { createApp } from 'vue'

import { init } from 'nuxt-app'
import plugins from 'nuxt-build/plugins.server'
import App from '<%= appPath %>'

export default async function createNuxtAppServer (ssrContext = {}) {
  const app = createApp(App)

  await init({
    app,
    plugins,
    ssrContext
  })

  await app.$nuxt.callHook('server:create')

  return app
}
