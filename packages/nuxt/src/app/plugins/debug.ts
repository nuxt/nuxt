import { createDebugger } from 'hookable'
import { defineNuxtPlugin } from '#app/nuxt'

export default defineNuxtPlugin((nuxtApp) => {
  createDebugger(nuxtApp.hooks, { tag: 'nuxt-app' })
})
