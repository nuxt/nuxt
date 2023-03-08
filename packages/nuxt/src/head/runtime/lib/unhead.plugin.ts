import { createHead, useHead } from '@unhead/vue'
import { renderSSRHead } from '@unhead/ssr'
import { defineNuxtPlugin } from '#app/nuxt'
// @ts-expect-error untyped
import { appHead } from '#build/nuxt.config.mjs'

export default defineNuxtPlugin((nuxtApp) => {
  const head = createHead()
  head.push(appHead)

  nuxtApp.vueApp.use(head)

  if (process.client) {
    // pause dom updates until page is ready and between page transitions
    let pauseDOMUpdates = true
    const unpauseDom = () => {
      pauseDOMUpdates = false
      // triggers dom update
      head.hooks.callHook('entries:updated', head)
    }
    head.hooks.hook('dom:beforeRender', (context) => { context.shouldRender = !pauseDOMUpdates })
    nuxtApp.hooks.hook('page:start', () => { pauseDOMUpdates = true })
    // wait for new page before unpausing dom updates (triggered after suspense resolved)
    nuxtApp.hooks.hook('page:finish', unpauseDom)
    nuxtApp.hooks.hook('app:mounted', unpauseDom)
  }

  // support backwards compatibility, remove at some point
  nuxtApp._useHead = useHead

  if (process.server) {
    nuxtApp.ssrContext!.renderMeta = async () => {
      const meta = await renderSSRHead(head)
      return {
        ...meta,
        bodyScriptsPrepend: meta.bodyTagsOpen,
        // resolves naming difference with NuxtMeta and Unhead
        bodyScripts: meta.bodyTags
      }
    }
  }
})
