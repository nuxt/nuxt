export default defineNuxtPlugin(async () => {
  if (useRequestEvent()?.req.headers.get('x-test-recurse-error')) {
    await $fetch('/api/error').catch(() => {})
  }
})
