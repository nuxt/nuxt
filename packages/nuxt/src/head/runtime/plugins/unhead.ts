import { createHead as createClientHead, setHeadInjectionHandler } from '@unhead/vue'
import { renderDOMHead } from '@unhead/dom'
import { defineNuxtPlugin, useNuxtApp } from '#app/nuxt'

// @ts-expect-error virtual file
import unheadPlugins from '#build/unhead-plugins.mjs'

export default defineNuxtPlugin({
  name: 'nuxt:head',
  enforce: 'pre',
  setup (nuxtApp) {
    const head = import.meta.server
      ? nuxtApp.ssrContext!.head
      : createClientHead({
        plugins: unheadPlugins
      })
    // allow useHead to be used outside a Vue context but within a Nuxt context
    setHeadInjectionHandler(
      // need a fresh instance of the nuxt app to avoid parallel requests interfering with each other
      () => useNuxtApp().vueApp._context.provides.usehead
    )
    // nuxt.config appHead is set server-side within the renderer
    nuxtApp.vueApp.use(head)

    if (import.meta.client) {
      // pause dom updates until page is ready and between page transitions
      let pauseDOMUpdates = true
      const syncHead = async () => {
        pauseDOMUpdates = false
        await renderDOMHead(head)
      }
      head.hooks.hook('dom:beforeRender', (context) => { context.shouldRender = !pauseDOMUpdates })
      nuxtApp.hooks.hook('page:start', () => { pauseDOMUpdates = true })
      // wait for new page before unpausing dom updates (triggered after suspense resolved)
      nuxtApp.hooks.hook('page:finish', () => {
        // app:suspense:resolve hook will unpause the DOM
        if (!nuxtApp.isHydrating) { syncHead() }
      })
      // unpause on error
      nuxtApp.hooks.hook('app:error', syncHead)
      // unpause the DOM once the mount suspense is resolved
      nuxtApp.hooks.hook('app:suspense:resolve', syncHead)
    }
  }
})
