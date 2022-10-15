import { createDebugger } from 'hookable'
import { defineNuxtPlugin } from '#app'

export default defineNuxtPlugin((nuxtApp) => {
  createDebugger(nuxtApp.hooks, { tag: 'nuxt-app' })
})
