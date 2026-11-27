import { createError, defineEventHandler } from 'h3'

export default defineEventHandler(() => {
  throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
})
