import { defineNuxtPlugin } from '#app/nuxt'

export default defineNuxtPlugin((nuxtApp) => {
  nuxtApp.hook('app:mounted', () => {
    try {
      const state = sessionStorage.getItem('nuxt:reload:state')
      if (state) {
        sessionStorage.removeItem('nuxt:reload:state')
        Object.assign(nuxtApp.payload.state, JSON.parse(state)?.state)
      }
    } catch {}
  })
})
