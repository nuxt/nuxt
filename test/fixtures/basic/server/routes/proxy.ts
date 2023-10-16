export default defineEventHandler(async () => {
  return await $fetch<string>('/')
})
