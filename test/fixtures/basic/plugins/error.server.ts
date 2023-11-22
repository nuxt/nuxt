export default defineNuxtPlugin(async () => {
  if (useRequestHeaders(['x-test-recurse-error'])['x-test-recurse-error']) {
    await useRequestFetch()('/api/error').catch(() => {})
  }
})
