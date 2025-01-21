import { createDebugger } from 'hookable'
import { defineNuxtPlugin } from '../nuxt'

export default defineNuxtPlugin({
  name: 'nuxt:debug:hooks',
  enforce: 'pre',
  setup (nuxtApp) {
    createDebugger(nuxtApp.hooks, { tag: 'nuxt-app' })
  },
})
