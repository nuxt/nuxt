import { CapoPlugin, HashHydrationPlugin } from '@unhead/vue'
import { defineNuxtPlugin } from '#app/nuxt'

export default defineNuxtPlugin({
  name: 'nuxt:head:next',
  setup (nuxtApp) {
    const head = nuxtApp.vueApp._context.provides.usehead
    head.use(CapoPlugin({ track: true }))
    head.use(HashHydrationPlugin())
  }
})
