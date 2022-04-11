export default defineNuxtPlugin(() => {
  useHead({
    titleTemplate: '%s - Fixture'
  })
  return {
    provide: {
      myPlugin: () => 'Injected by my-plugin'
    }
  }
})
