export default defineNuxtPlugin((nuxtApp) => {
  // Pretend to be prerendered
  nuxtApp.payload.prerenderedAt = Date.now()
})
