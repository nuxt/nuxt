import { defineEventHandler } from 'nitro/h3'

const handler: ReturnType<typeof defineEventHandler> = defineEventHandler((event) => {
  if (event.req.headers.get('x-nuxt-no-ssr')) {
    event.context.nuxt ||= {}
    event.context.nuxt.noSSR = true
  }
})

export default handler
