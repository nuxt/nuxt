import { createHead as createClientHead, renderDOMHead } from '@unhead/vue/client'
import type { ActiveHeadEntry } from '@unhead/vue'
import { defineNuxtPlugin } from '#app/nuxt'

// @ts-expect-error virtual file
import unheadOptions from '#build/unhead-options.mjs'

export default defineNuxtPlugin({
  name: 'nuxt:head',
  enforce: 'pre',
  setup (nuxtApp) {
    const head = import.meta.server
      ? nuxtApp.ssrContext!.head
      : createClientHead(unheadOptions)
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

      // Defer head-entry disposal during a page transition.
      const originalPush = head.push.bind(head)
      head.push = ((input: Parameters<typeof head.push>[0], options?: Parameters<typeof head.push>[1]) => {
        const entry = originalPush(input, options) as ActiveHeadEntry<typeof input>
        const originalDispose = entry.dispose.bind(entry)
        entry.dispose = () => {
          const transitionPromise = nuxtApp['~transitionPromise']
          if (transitionPromise) {
            transitionPromise.then(originalDispose)
          } else {
            originalDispose()
          }
        }
        return entry
      }) as typeof head.push
    }
  },
})
