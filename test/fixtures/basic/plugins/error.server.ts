export default defineNuxtPlugin(async () => {
  if (useRequestHeaders(['x-recurse'])['x-recurse']) {
    await useRequestFetch()('/api/error').catch(() => {})
  }
})
