export default defineNuxtPlugin((nuxtApp) => {
  const route = useRoute()
  nuxtApp.hook('page:loading:end', () => {
    if (route.path === '/page-load-hook') {
      console.log('page:loading:end')
    }
  })
})
