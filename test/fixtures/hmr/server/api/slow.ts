export default defineEventHandler(async () => {
  await new Promise(resolve => setTimeout(resolve, 500))
  return { message: 'loaded' }
})
