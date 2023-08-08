
export default defineNuxtPlugin((nuxtApp) => {
  nuxtApp.hook('vue:error', (err) => {
    console.log('Erro from plugin: ', err)
  })
})
