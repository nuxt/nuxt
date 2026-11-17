import { defineEventHandler } from 'h3'

export default defineEventHandler(() => ({
  getQuery: typeof getQuery,
  useRuntimeConfig: typeof useRuntimeConfig,
}))
