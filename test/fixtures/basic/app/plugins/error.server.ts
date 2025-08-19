export default defineNuxtPlugin(async () => {
  if (useRequestEvent()?.req.headers.get('x-test-recurse-error')) {
    await useRequestFetch()('/api/error').catch(() => {})
  }
})
