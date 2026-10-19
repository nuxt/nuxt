export default defineNuxtPlugin((nuxtApp) => {
  const w = window as any
  w.__bench = { entryAt: performance.now() }
  nuxtApp.hook('app:suspense:resolve', () => {
    w.__bench.suspenseAt = performance.now()
  })
})
