export default defineNuxtPlugin(async () => {
  await new Promise(resolve => setTimeout(resolve, 50))
})
