import destr from 'destr'
import { defineNuxtPlugin, useNuxtApp } from '#app/nuxt'

export default defineNuxtPlugin({
  name: 'nuxt:restore-state',
  hooks: {
    'app:mounted' () {
      const nuxtApp = useNuxtApp()
      try {
        const state = sessionStorage.getItem('nuxt:reload:state')
        if (state) {
          sessionStorage.removeItem('nuxt:reload:state')
          Object.assign(nuxtApp.payload.state, destr<Record<string, any>>(state)?.state)
        }
      } catch {}
    }
  }
})
