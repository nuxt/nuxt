import { injectHead, CapoPlugin } from '@unhead/vue'
import { defineNuxtPlugin } from '#app/nuxt'

export default defineNuxtPlugin({
  name: 'nuxt:head:capo',
  setup () {
    injectHead().use(CapoPlugin)
  }
})
