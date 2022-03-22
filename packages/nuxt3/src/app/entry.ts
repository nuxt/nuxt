// We set __webpack_public_path via this import with webpack builder
import '#build/paths.mjs'
import { createSSRApp, createApp, nextTick } from 'vue'
import { createNuxtApp, applyPlugins, normalizePlugins, CreateOptions } from '#app'
import '#build/css'
// @ts-ignore
import _plugins from '#build/plugins'
// @ts-ignore
import RootComponent from '#build/root-component.mjs'
// @ts-ignore
import AppComponent from '#build/app-component.mjs'

let entry: Function

const plugins = normalizePlugins(_plugins)

if (process.server) {
  entry = async function createNuxtAppServer (ssrContext: CreateOptions['ssrContext'] = {}) {
    const vueApp = createApp(RootComponent)
    vueApp.component('App', AppComponent)

    const nuxt = createNuxtApp({ vueApp, ssrContext })

    try {
      await applyPlugins(nuxt, plugins)
      await nuxt.hooks.callHook('app:created', vueApp)
    } catch (err) {
      await nuxt.callHook('app:error', err)
      ssrContext.error = ssrContext.error || err
    }

    return vueApp
  }
}

if (process.client) {
  // TODO: temporary webpack 5 HMR fix
  // https://github.com/webpack-contrib/webpack-hot-middleware/issues/390
  // @ts-ignore
  if (process.dev && import.meta.webpackHot) {
    // @ts-ignore
    import.meta.webpackHot.accept()
  }

  entry = async function initApp () {
    const isSSR = Boolean(window.__NUXT__?.serverRendered)
    const vueApp = isSSR ? createSSRApp(RootComponent) : createApp(RootComponent)
    vueApp.component('App', AppComponent)

    const nuxt = createNuxtApp({ vueApp })

    nuxt.hooks.hookOnce('app:suspense:resolve', () => {
      nuxt.isHydrating = false
    })

    try {
      await applyPlugins(nuxt, plugins)
    } catch (err) {
      await nuxt.callHook('app:error', err)
      nuxt.payload.error = nuxt.payload.error || err
    }

    try {
      await nuxt.hooks.callHook('app:created', vueApp)
      await nuxt.hooks.callHook('app:beforeMount', vueApp)
      vueApp.mount('#__nuxt')
      await nuxt.hooks.callHook('app:mounted', vueApp)
      await nextTick()
    } catch (err) {
      await nuxt.callHook('app:error', err)
      nuxt.payload.error = nuxt.payload.error || err
    }
  }

  entry().catch((error) => {
    console.error('Error while mounting app:', error) // eslint-disable-line no-console
  })
}

export default (ctx?: CreateOptions['ssrContext']) => entry(ctx)
