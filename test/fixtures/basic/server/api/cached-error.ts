import { createError } from 'nuxt/server'

let count = 0

export default defineEventHandler(() => {
  throw createError({ status: 404, data: { count: count++ } })
})
