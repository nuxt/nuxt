import { createApp } from 'vue'
import { createNuxt, applyPlugins } from 'nuxt/app/nuxt'
import plugins from './plugins'
import serverPlugins from './plugins.server'
import App from '<%= app.main %>'

export default async function createNuxtAppServer (ssrContext = {}) {
  const app = createApp(App)

  const nuxt = createNuxt({ app, ssrContext })

  await applyPlugins(nuxt, plugins)
  await applyPlugins(nuxt, serverPlugins)

  await app.$nuxt.hooks.callHook('app:created', app)

  nuxt.hooks.hook('vue-renderer:done',
    () => nuxt.hooks.callHook('app:rendered', app)
  )

  return app
}
