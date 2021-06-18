import { createSSRApp, createApp, nextTick } from 'vue'
import { createNuxt, applyPlugins, normalizePlugins } from '@nuxt/app'
// @ts-ignore
import _plugins from '#build/plugins'
// @ts-ignore
import App from '#build/app'

let entry: Function

const plugins = normalizePlugins(_plugins)

if (process.server) {
  entry = async function createNuxtAppServer (ssrContext = {}) {
    const app = createApp(App)

    const nuxt = createNuxt({ app, ssrContext })

    await applyPlugins(nuxt, plugins)

    await nuxt.hooks.callHook('app:created', app)

    return app
  }
}

if (process.client) {
  entry = async function initApp () {
    const app = createSSRApp(App)

    const nuxt = createNuxt({ app })

    await applyPlugins(nuxt, plugins)

    await nuxt.hooks.callHook('app:created', app)
    await nuxt.hooks.callHook('app:beforeMount', app)

    app.mount('#__nuxt')

    await nuxt.hooks.callHook('app:mounted', app)
    await nextTick()
    nuxt.isHydrating = false
  }

  entry().catch((error) => {
    console.error('Error while mounting app:', error) // eslint-disable-line no-console
  })
}

export default ctx => entry(ctx)
