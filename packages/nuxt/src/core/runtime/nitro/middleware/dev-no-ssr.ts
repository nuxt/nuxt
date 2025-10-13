import { defineEventHandler, getQuery } from 'h3'

export default defineEventHandler((event) => {
  // Check for header or query parameter to disable SSR
  if (getQuery(event)['nuxt-no-ssr']) {
    event.context.nuxt ||= {}
    event.context.nuxt.noSSR = true
  }
})
