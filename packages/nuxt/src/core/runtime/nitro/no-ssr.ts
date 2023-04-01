import { defineEventHandler, getRequestHeader } from 'h3'

export default defineEventHandler((event) => {
  if (getRequestHeader(event, 'x-nuxt-no-ssr') === 'true') {
    event.context.nuxt = event.context.nuxt || {}
    event.context.nuxt.noSSR = true
  }
})
