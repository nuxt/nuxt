import type { H3Event } from 'nitro/h3'

export default defineEventHandler((event: H3Event) => {
  if (event.context.fromConfiguredMiddleware) {
    event.res.headers.set('x-server-middleware-order', 'configured-first')
  }
})
