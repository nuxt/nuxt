export default defineEventHandler(async () => {
  throw createError({ statusCode: 400 })
})
