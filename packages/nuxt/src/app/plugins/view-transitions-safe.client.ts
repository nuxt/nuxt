import { defineNuxtPlugin } from '#app/nuxt'
import plugin from '#app/plugins/view-transitions.client'

export default defineNuxtPlugin((nuxtApp) => {
  if (!document.startViewTransition || window.matchMedia('(prefers-reduced-motion: reduce)').matches) { return }

  plugin(nuxtApp)
})
