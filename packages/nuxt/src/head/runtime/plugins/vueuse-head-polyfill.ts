/* eslint-disable @typescript-eslint/no-deprecated */
import type { UseHeadInput, UseHeadOptions, VueHeadClient } from '@unhead/vue'
import { defineNuxtPlugin } from '#app/nuxt'
import { useHead } from '#app/composables/head'

export type VueHeadClientPollyFill = VueHeadClient & {
  /**
   * @deprecated use `resolveTags`
   */
  headTags: VueHeadClient['resolveTags']
  /**
   * @deprecated use `push`
   */
  addEntry: VueHeadClient['push']
  /**
   * @deprecated use `push`
   */
  addHeadObjs: VueHeadClient['push']
  /**
   * @deprecated use `useHead`
   */
  addReactiveEntry: (input: UseHeadInput, options?: UseHeadOptions) => (() => void)
  /**
   * @deprecated Use useHead API.
   */
  removeHeadObjs: () => void
  /**
   * @deprecated Call hook `entries:resolve` or update an entry
   */
  updateDOM: () => void
  /**
   * @deprecated Access unhead properties directly.
   */
  unhead: VueHeadClient
}

/**
 * @deprecated Will be removed in Nuxt v4.
 */
function polyfillAsVueUseHead (head: VueHeadClient): VueHeadClientPollyFill {
  const polyfilled = head as VueHeadClientPollyFill
  // add a bunch of @vueuse/head compat functions
  polyfilled.headTags = head.resolveTags
  polyfilled.addEntry = head.push
  polyfilled.addHeadObjs = head.push
  polyfilled.addReactiveEntry = (input, options) => {
    const api = useHead(input, options)
    if (api !== undefined) { return api.dispose }
    return () => {}
  }
  // not able to handle this
  polyfilled.removeHeadObjs = () => {}
  // trigger DOM
  polyfilled.updateDOM = () => {
    head.hooks.callHook('entries:updated', head)
  }
  polyfilled.unhead = head
  return polyfilled
}

export default defineNuxtPlugin({
  name: 'nuxt:vueuse-head-polyfill',
  setup (nuxtApp) {
    // avoid breaking ecosystem dependencies using low-level @vueuse/head APIs
    polyfillAsVueUseHead(nuxtApp.vueApp._context.provides.usehead)
  },
})
