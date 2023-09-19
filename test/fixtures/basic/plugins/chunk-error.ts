export default defineNuxtPlugin((nuxtApp) => {
  nuxtApp.hook('app:chunkError', () => {
    // eslint-disable-next-line no-console
    process.client && console.log('caught chunk load error')
  })
})
