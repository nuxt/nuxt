import { createApp, createSSRApp, nextTick } from 'vue'
import type { App } from 'vue'

// These files must be imported first as they have side effects:
// 1. (we set __webpack_public_path via this import, if using webpack builder)
import '#build/paths.mjs'
// 2. we set globalThis.$fetch via this import
import '#build/fetch.mjs'

import { applyPlugins, createNuxtApp } from './nuxt'
import type { CreateOptions } from './nuxt'

import '#build/css'
// @ts-expect-error virtual file
import plugins from '#build/plugins'
// @ts-expect-error virtual file
import RootComponent from '#build/root-component.mjs'
// @ts-expect-error virtual file
import { vueAppRootContainer } from '#build/nuxt.config.mjs'

let entry: (ssrContext?: CreateOptions['ssrContext']) => Promise<App<Element>>

if (import.meta.server) {
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
    if (ssrContext?._renderResponse) { throw new Error('skipping render') }

    return vueApp
  }
}

if (import.meta.client) {
  // TODO: temporary webpack 5 HMR fix
  // https://github.com/webpack-contrib/webpack-hot-middleware/issues/390
  if (import.meta.dev && import.meta.webpackHot) {
    import.meta.webpackHot.accept()
  }

  // eslint-disable-next-line
  let vueAppPromise: Promise<App<Element>>

  entry = async function initApp () {
    if (vueAppPromise) { return vueAppPromise }
    const isSSR = Boolean(
      window.__NUXT__?.serverRendered ||
      document.getElementById('__NUXT_DATA__')?.dataset.ssr === 'true'
    )
    const vueApp = isSSR ? createSSRApp(RootComponent) : createApp(RootComponent)

    const nuxt = createNuxtApp({ vueApp })

    async function handleVueError(err: any) {
      await nuxt.callHook('app:error', err)
      nuxt.payload.error = (nuxt.payload.error || err) as any
    }

    vueApp.config.errorHandler = handleVueError

    try {
      await applyPlugins(nuxt, plugins)
    } catch (err) {
      handleVueError(err)
    }

    try {
      await nuxt.hooks.callHook('app:created', vueApp)
      await nuxt.hooks.callHook('app:beforeMount', vueApp)
      vueApp.mount(vueAppRootContainer)
      await nuxt.hooks.callHook('app:mounted', vueApp)
      await nextTick()
    } catch (err) {
      handleVueError(err)
    }

    // If the errorHandler is not overridden by the user, we unset it
    if (vueApp.config.errorHandler === handleVueError)
      vueApp.config.errorHandler = undefined

    return vueApp
  }

  vueAppPromise = entry().catch((error: unknown) => {
    console.error('Error while mounting app:', error)
    throw error
  })
}

export default (ssrContext?: CreateOptions['ssrContext']) => entry(ssrContext)
