import { defineNuxtPlugin } from '#app/nuxt'
import type { ObjectPlugin, Plugin } from '#app/nuxt'
import { freezeHead } from '../island-head'

const plugin: Plugin & ObjectPlugin = defineNuxtPlugin({
  name: 'nuxt:head',
  enforce: 'pre',
  setup (nuxtApp) {
    const head = nuxtApp.ssrContext!.head

    // Drop plugin-phase `useHead` writes for islands -- they belong to the
    // surrounding route, not the island response. Unfreeze on `app:created`
    // (after `applyPlugins` resolves) so island components write normally.
    if (nuxtApp.ssrContext!.islandContext) {
      const unfreeze = freezeHead(head)
      nuxtApp.hooks.hookOnce('app:created', unfreeze)
    }

    // nuxt.config appHead is set server-side within the renderer
    nuxtApp.vueApp.use(head)
  },
})

export default plugin
