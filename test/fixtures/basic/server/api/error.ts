export default defineEventHandler(() => {
  throw createError({ status: 400 })
})
