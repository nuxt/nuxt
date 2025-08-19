import { defineEventHandler } from 'h3'

export default defineEventHandler((event) => {
  if (event.req.headers.get('x-nuxt-no-ssr')) {
    event.context.nuxt ||= {}
    event.context.nuxt.noSSR = true
  }
})
