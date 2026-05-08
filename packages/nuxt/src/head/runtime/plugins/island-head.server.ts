import { createHead } from '@unhead/vue/server'
import { headSymbol } from '@unhead/vue'
import { defineNuxtPlugin } from '#app/nuxt'

// @ts-expect-error virtual file
import unheadOptions from '#build/unhead-options.mjs'

// When rendering an island, we want the response head to contain only the
// island's own entries -- not anything registered by user plugins via `useHead`
// during the same SSR pass. Previously this was done by clearing the injected
// head inside `IslandRenderer.setup`, but that head can be cross-resolved to a
// concurrent route's head (Vue's module-global `currentInstance` under
// concurrent prerender), wiping unrelated entries -- see #32100.
//
// Running here, after all user plugins have populated `ssrContext.head`, lets
// us swap the island request to a fresh, isolated head without ever mutating
// shared state.
export default defineNuxtPlugin({
  name: 'nuxt:island-head',
  enforce: 'post',
  setup (nuxtApp) {
    if (!nuxtApp.ssrContext?.islandContext) { return }
    const head = createHead(unheadOptions)
    nuxtApp.ssrContext.head = head
    nuxtApp.vueApp.provide(headSymbol, head)
  },
})
