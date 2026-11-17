import { defineEventHandler, getQuery } from 'nuxt/server'

export default defineEventHandler(event => ({
  method: event.req.method,
  path: event.url.pathname,
  query: getQuery(event),
}))
