import { defineEventHandler, getQuery } from 'nuxt/server'

export default defineEventHandler(event => ({
  variant: 'nuxt',
  query: getQuery(event).q,
}))
