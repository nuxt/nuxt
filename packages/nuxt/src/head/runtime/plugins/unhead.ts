import { createHead as createClientHead } from '@unhead/vue/client'
import { createStreamableHead as createStreamableClientHead } from '@unhead/vue/stream/client'
import { defineNuxtPlugin } from '#app/nuxt'

// @ts-expect-error virtual file
import unheadOptions from '#build/unhead-options.mjs'
// @ts-expect-error virtual file
import { ssrStreaming } from '#build/unhead.config.mjs'

export default defineNuxtPlugin({
  name: 'nuxt:head',
  enforce: 'pre',
  setup (nuxtApp) {
    // When streaming is enabled, use createStreamableHead to consume the
    // window.__unhead__ queue populated during SSR streaming. Falls back
    // to createClientHead if no stream queue is found (e.g. bot requests
    // that received a fully-buffered response).
    const head = import.meta.server
      ? nuxtApp.ssrContext!.head
      : ssrStreaming
        ? (createStreamableClientHead(unheadOptions) || createClientHead(unheadOptions))
        : createClientHead(unheadOptions)
    // nuxt.config appHead is set server-side within the renderer
    nuxtApp.vueApp.use(head)

    if (import.meta.client) {
      // pause dom updates until page is ready and between page transitions
      let pauseDOMUpdates = true
      const syncHead = () => {
        pauseDOMUpdates = false
        head.render()
      }
      head.hooks?.hook('dom:beforeRender', (context) => { context.shouldRender = !pauseDOMUpdates })
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
  },
})
