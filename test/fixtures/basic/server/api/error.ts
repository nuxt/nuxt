import { createError } from 'nuxt/server'

export default defineEventHandler(() => {
  throw createError({ status: 400 })
})
