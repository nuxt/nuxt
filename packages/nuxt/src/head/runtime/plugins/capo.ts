import { CapoPlugin } from '@unhead/vue'
import { defineNuxtPlugin } from '#app/nuxt'

export default defineNuxtPlugin({
  name: 'nuxt:head:capo',
  setup (nuxtApp) {
    nuxtApp.vueApp._context.provides.usehead.use(CapoPlugin({ track: true }))
  }
})
