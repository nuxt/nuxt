import { createDebugger } from 'hookable'
import { defineNuxtPlugin } from '#app/nuxt'

export default defineNuxtPlugin({
  name: 'nuxt:debug',
  enforce: 'pre',
  setup (nuxtApp) {
    createDebugger(nuxtApp.hooks, { tag: 'nuxt-app' })
  }
})
