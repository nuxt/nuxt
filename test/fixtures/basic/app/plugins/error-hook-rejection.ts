export default defineNuxtPlugin((nuxtApp) => {
  if (useRoute().query['hook-rejection'] !== (import.meta.server ? 'server' : 'client')) {
    return
  }
  nuxtApp.hook('app:error', () => {
    throw new Error('app:error hook failed')
  })
  throw createError({ status: 418, statusText: 'Plugin failed', message: 'plugin failed', fatal: true })
})
