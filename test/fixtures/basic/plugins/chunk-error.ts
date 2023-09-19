export default defineNuxtPlugin((nuxtApp) => {
  nuxtApp.hook('app:chunkError', () => {
    process.client && console.log('caught chunk load error')
  })
})
