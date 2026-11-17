export default defineNuxtPlugin(async () => {
  await new Promise(resolve => setTimeout(resolve, 1))
  if (!tryUseNuxtApp()) {
    throw new Error('Nuxt instance unavailable after `await`')
  }
})
