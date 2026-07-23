export default defineNuxtPlugin((nuxtApp) => {
  const prefetched: string[] = []
  ;(window as any).__prefetchedLinks = prefetched
  nuxtApp.hooks.hook('link:prefetch', (link) => { prefetched.push(link) })
})
