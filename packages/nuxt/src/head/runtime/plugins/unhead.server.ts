import { defineNuxtPlugin } from '#app/nuxt'
import type { ObjectPlugin, Plugin } from '#app/nuxt'
import { freezeHead } from '../island-head'

import { appComponentHead } from '#build/unhead.config.mjs'

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
    } else if (appComponentHead.length) {
      // head input hoisted from the app component applies where the app component sets up
      nuxtApp.hooks.hookOnce('vue:setup', () => {
        for (const input of appComponentHead) {
          head.push(input)
        }
      })
    }

    // nuxt.config appHead is set server-side within the renderer
    nuxtApp.vueApp.use(head)
  },
})

export default plugin
