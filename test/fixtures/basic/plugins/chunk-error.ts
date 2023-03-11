export default defineNuxtPlugin((nuxtApp) => {
  nuxtApp.hook('app:chunkError', () => console.log('caught chunk load error'))
})
