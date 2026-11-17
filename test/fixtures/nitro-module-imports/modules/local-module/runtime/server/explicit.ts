import { defineEventHandler, getQuery, useRuntimeConfig } from '#imports'

export default defineEventHandler(event => ({
  query: getQuery(event),
  baseURL: useRuntimeConfig(event).app.baseURL,
}))
