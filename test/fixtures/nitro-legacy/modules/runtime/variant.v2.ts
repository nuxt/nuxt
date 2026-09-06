import { defineEventHandler, getQuery } from 'h3'

export default defineEventHandler(event => ({
  variant: 'nitro2',
  query: getQuery(event).q,
}))
