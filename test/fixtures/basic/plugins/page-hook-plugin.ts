export default defineNuxtPlugin((nuxtApp) => {
  nuxtApp.hook('page:loading:end', () => {
    console.log('page:loading:end')
  })
})
