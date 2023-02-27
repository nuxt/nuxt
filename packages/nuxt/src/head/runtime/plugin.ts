import { useHead, createHead, createServerHead } from '@unhead/vue'
import { polyfillAsVueUseHead } from '@unhead/vue/polyfill'
import { renderSSRHead } from '@unhead/ssr'
import type { VueHeadClient } from '@unhead/vue'
import { defineNuxtPlugin } from '#app/nuxt'
import type { HeadAugmentations, CreateHeadOptions } from 'nuxt/schema'
// @ts-expect-error untyped
import { appHead } from '#build/nuxt.config.mjs'

export default defineNuxtPlugin((nuxtApp) => {
  const headOptions: CreateHeadOptions = {}
  nuxtApp.hooks.hook('head:init', headOptions)
  let head: VueHeadClient<HeadAugmentations>
  if (process.server) {
    head = createServerHead<HeadAugmentations>(headOptions)
    // when SSR it's safe to only render the appHead server side
    head.push(appHead, { mode: 'server' })
  } else {
    // SPA mode
    head = createHead<HeadAugmentations>(headOptions)
    head.push(appHead)
  }
  // avoid breaking ecosystem dependencies using low-level @vueuse/head APIs
  head = polyfillAsVueUseHead(head)

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

  // useHead does not depend on a vue component context, we keep it on the nuxtApp for backwards compatibility
  nuxtApp._useHead = useHead

  if (process.server) {
    nuxtApp.ssrContext!.renderMeta = async () => {
      const meta = await renderSSRHead(head)
      return {
        ...meta,
        bodyScriptsPrepend: meta.bodyTagsOpen,
        bodyScripts: meta.bodyTags
      }
    }
  }
})
