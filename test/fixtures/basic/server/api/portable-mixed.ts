import { getValidatedQuery } from 'nuxt/server'

export default defineEventHandler(event => getValidatedQuery(event as never, query => query))
