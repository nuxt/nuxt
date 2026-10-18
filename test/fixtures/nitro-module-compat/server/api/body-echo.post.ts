import { defineEventHandler, readBody } from 'nuxt/server'

export default defineEventHandler(async event => ({
  fromMiddleware: event.context.bodyFromMiddleware,
  fromRoute: await readBody(event),
}))
