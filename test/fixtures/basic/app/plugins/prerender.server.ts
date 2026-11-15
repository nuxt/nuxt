export default defineNuxtPlugin((nuxtApp) => {
  // Pretend to be prerendered, except for the pages that test scrolling on load
  if (!useRoute().path.startsWith('/scroll')) {
    nuxtApp.payload.prerenderedAt = Date.now()
  }
})
