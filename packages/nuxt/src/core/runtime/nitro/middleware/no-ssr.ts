import { defineEventHandler, getQuery, getRequestHeader } from 'h3'

export default defineEventHandler((event) => {
  const query = getQuery(event)
  
  // Check for header or query parameter to disable SSR
  if (getRequestHeader(event, 'x-nuxt-no-ssr') || query._nuxt_no_ssr) {
    event.context.nuxt ||= {}
    event.context.nuxt.noSSR = true
  }
})
