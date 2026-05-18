import type { H3Event } from 'nitro/h3'

export default defineEventHandler((event: H3Event) => {
  event.context.fromConfiguredMiddleware = true
})
