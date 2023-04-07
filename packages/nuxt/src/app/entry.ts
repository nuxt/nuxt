// We set __webpack_public_path via this import with webpack builder
import { createApp, createSSRApp, nextTick } from 'vue'
import { $fetch } from 'ofetch'
// @ts-ignore
import { baseURL } from '#build/paths.mjs'
import type { CreateOptions } from '#app'
import { applyPlugins, createNuxtApp, normalizePlugins } from '#app/nuxt'
import '#build/css'
// @ts-ignore
import _plugins from '#build/plugins'
// @ts-ignore
import RootComponent from '#build/root-component.mjs'
// @ts-ignore
import { appRootId } from '#build/nuxt.config.mjs'

if (!globalThis.$fetch) {
  // @ts-ignore
  globalThis.$fetch = $fetch.create({
    baseURL: baseURL()
  })
}

let entry: Function

const plugins = normalizePlugins(_plugins)

if (process.server) {
  entry = async function createNuxtAppServer (ssrContext: CreateOptions['ssrContext']) {
    const vueApp = createApp(RootComponent)

    const nuxt = createNuxtApp({ vueApp, ssrContext })

    try {
      await applyPlugins(nuxt, plugins)
      await nuxt.hooks.callHook('app:created', vueApp)
    } catch (err) {
      await nuxt.hooks.callHook('app:error', err)
      nuxt.payload.error = (nuxt.payload.error || err) as any
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
    const isSSR = Boolean(
      window.__NUXT__?.serverRendered ||
      document.getElementById('__NUXT_DATA__')?.dataset.ssr === 'true'
    )
    const vueApp = isSSR ? createSSRApp(RootComponent) : createApp(RootComponent)

    const nuxt = createNuxtApp({ vueApp })

    try {
      await applyPlugins(nuxt, plugins)
    } catch (err) {
      await nuxt.callHook('app:error', err)
      nuxt.payload.error = (nuxt.payload.error || err) as any
    }

    try {
      await nuxt.hooks.callHook('app:created', vueApp)
      await nuxt.hooks.callHook('app:beforeMount', vueApp)
      vueApp.mount('#' + appRootId)
      await nuxt.hooks.callHook('app:mounted', vueApp)
      await nextTick()
    } catch (err) {
      await nuxt.callHook('app:error', err)
      nuxt.payload.error = (nuxt.payload.error || err) as any
    }
  }

  entry().catch((error: unknown) => {
    console.error('Error while mounting app:', error)
  })
}

export default (ctx?: CreateOptions['ssrContext']) => entry(ctx)
