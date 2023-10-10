import { defineNuxtPlugin } from '#app/nuxt'

export default defineNuxtPlugin({
  name: 'nuxt:async-data-shallow',
  enforce: 'pre',
  setup (nuxtApp) {
    nuxtApp._asyncDataShallow = true
  }
})
