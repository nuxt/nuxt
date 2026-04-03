export default defineLazyNuxtPlugin((nuxtApp) => {
  useState('lazy-plugin-ran').value = true

  nuxtApp.hook('page:finish', () => {
    useState('lazy-plugin-navigated').value = true
  })
})
