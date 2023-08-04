import { createHead as createClientHead } from '@unhead/vue'
import { defineNuxtPlugin } from '#app/nuxt'

export default defineNuxtPlugin({
  name: 'nuxt:head',
  setup (nuxtApp) {
    const head = process.server ? nuxtApp.ssrContext!.head : createClientHead()
    // nuxt.config appHead is set server-side within the renderer
    nuxtApp.vueApp.use(head)

    if (process.client) {
      // pause dom updates until page is ready and between page transitions
      let pauseDOMUpdates = true
      const unpauseDom = () => {
        pauseDOMUpdates = false
        // trigger the debounced DOM update
        head.hooks.callHook('entries:updated', head)
      }
      head.hooks.hook('dom:beforeRender', (context) => { context.shouldRender = !pauseDOMUpdates })
      nuxtApp.hooks.hook('page:start', () => { pauseDOMUpdates = true })
      // wait for new page before unpausing dom updates (triggered after suspense resolved)
      nuxtApp.hooks.hook('page:finish', unpauseDom)
      // unpause the DOM once the mount suspense is resolved
      nuxtApp.hooks.hook('app:suspense:resolve', unpauseDom)
    }
  }
})
