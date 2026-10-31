import { defineEventHandler, getQuery } from 'h3'

export default defineEventHandler(event => ({ q: getQuery(event).q ?? null }))
