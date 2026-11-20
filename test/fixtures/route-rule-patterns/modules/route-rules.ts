import { defineNuxtModule, extendRouteRules } from 'nuxt/kit'

export default defineNuxtModule({
  setup () {
    extendRouteRules('/module/*', { appMiddleware: 'probe' })
  },
})
